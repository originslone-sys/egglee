<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\Env;

/** Cliente DeepSeek (chat/completions) via cURL. Roda no servidor (Hostinger). */
final class DeepSeek
{
    /**
     * Chamada de baixo nível. Sempre retorna um array com o resultado, nunca
     * "morre" silenciosamente — assim conseguimos registrar o erro real.
     *
     * @return array{ok:bool, http:int, elapsed:float, error:?string, content:?string}
     */
    public static function request(array $messages, array $opts = []): array
    {
        $apiKey = Env::get('DEEPSEEK_API_KEY');
        if (!$apiKey) {
            return ['ok' => false, 'http' => 0, 'elapsed' => 0.0, 'error' => 'DEEPSEEK_API_KEY não configurada no .env.', 'content' => null];
        }
        $url     = Env::get('DEEPSEEK_API_URL', 'https://api.deepseek.com/chat/completions');
        $model   = $opts['model']   ?? Env::get('DEEPSEEK_MODEL', 'deepseek-v4-flash');
        $timeout = $opts['timeout'] ?? (int) Env::get('DEEPSEEK_TIMEOUT', '110');
        $maxTok  = $opts['max_tokens'] ?? 8000;

        $payload = [
            'model'       => $model,
            'messages'    => $messages,
            'temperature' => $opts['temperature'] ?? 0.9,
            'max_tokens'  => $maxTok,
            'stream'      => false,
        ];

        // Modelos V4 vêm com "thinking" LIGADO por padrão — isso devolve o
        // conteúdo vazio/lento no nosso fluxo. Desligamos (modo não-pensante),
        // a menos que explicitamente pedido. Só se aplica aos modelos v4.
        if (str_starts_with($model, 'deepseek-v4')) {
            $thinking = $opts['thinking'] ?? Env::get('DEEPSEEK_THINKING', 'disabled');
            $payload['thinking'] = ['type' => $thinking === 'enabled' ? 'enabled' : 'disabled'];
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', "Authorization: Bearer $apiKey"],
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_CONNECTTIMEOUT => 20,       // falha rápido se não conectar (rede bloqueada)
            CURLOPT_TIMEOUT        => $timeout, // teto total
        ]);
        $body    = curl_exec($ch);
        $code    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $elapsed = (float) curl_getinfo($ch, CURLINFO_TOTAL_TIME);
        $cerr    = curl_error($ch);
        $cerrno  = curl_errno($ch);
        curl_close($ch);

        if ($body === false) {
            return ['ok' => false, 'http' => $code, 'elapsed' => $elapsed,
                    'error' => "Falha de rede (curl $cerrno): $cerr", 'content' => null];
        }
        if ($code < 200 || $code >= 300) {
            return ['ok' => false, 'http' => $code, 'elapsed' => $elapsed,
                    'error' => "HTTP $code: " . substr((string) $body, 0, 300), 'content' => null];
        }
        $data = json_decode((string) $body, true);
        $content = $data['choices'][0]['message']['content'] ?? null;
        if (!is_string($content) || $content === '') {
            return ['ok' => false, 'http' => $code, 'elapsed' => $elapsed,
                    'error' => 'Resposta sem content.', 'content' => null];
        }
        return ['ok' => true, 'http' => $code, 'elapsed' => $elapsed, 'error' => null, 'content' => $content];
    }

    /**
     * Gera o conteúdo de um símbolo em um idioma (formato do nosso schema).
     * @throws \RuntimeException com a causa real em caso de falha.
     */
    public static function generate(string $id, string $category, string $conceptEn, string $lang, array $related = []): array
    {
        $messages = PromptBuilder::build($id, $category, $conceptEn, $lang, $related);
        $res = self::request($messages);
        if (!$res['ok']) {
            throw new \RuntimeException($res['error'] ?? 'Falha desconhecida na IA.');
        }
        return self::parseJson($res['content']);
    }

    /**
     * Diagnóstico: testa a conexão/credencial com uma chamada curta.
     * Testa o modelo configurado e também o deepseek-chat (rápido) para
     * distinguir "problema de rede/chave" de "modelo lento demais".
     */
    public static function diagnose(): array
    {
        $msg = [['role' => 'user', 'content' => 'Responda apenas com a palavra: ok']];
        $configured = Env::get('DEEPSEEK_MODEL', 'deepseek-v4-flash');

        $out = [
            'hasKey'     => (bool) Env::get('DEEPSEEK_API_KEY'),
            'configured' => $configured,
        ];
        // Referência rápida: v4-flash sem thinking (config que usamos na geração).
        $out['chat']      = self::request($msg, ['model' => 'deepseek-v4-flash', 'timeout' => 45, 'max_tokens' => 32, 'temperature' => 0]);
        // O modelo configurado, do MESMO jeito que a geração o usa.
        $out['confModel'] = self::request($msg, ['model' => $configured, 'timeout' => 45, 'max_tokens' => 32, 'temperature' => 0]);
        return $out;
    }

    /** Extrai o objeto JSON mesmo se vier embrulhado em ```json ... ``` ou texto. */
    public static function parseJson(string $raw): array
    {
        $s = trim($raw);
        if (preg_match('/```(?:json)?\s*([\s\S]*?)```/i', $s, $m)) {
            $s = trim($m[1]);
        }
        $start = strpos($s, '{');
        $end   = strrpos($s, '}');
        if ($start === false || $end === false) {
            throw new \RuntimeException('Sem objeto JSON na resposta.');
        }
        $obj = json_decode(substr($s, $start, $end - $start + 1), true);
        if (!is_array($obj)) {
            throw new \RuntimeException('JSON inválido na resposta da IA.');
        }
        return $obj;
    }
}
