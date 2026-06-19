<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\Env;

/** Cliente DeepSeek (chat/completions) via cURL. Roda no servidor (Hostinger). */
final class DeepSeek
{
    /**
     * Gera o conteúdo de um símbolo em um idioma e devolve o array já no
     * formato do nosso schema (chaves camelCase).
     *
     * @return array conteúdo decodificado
     * @throws \RuntimeException em falha de API ou JSON inválido
     */
    public static function generate(string $id, string $category, string $term, string $lang, array $related = []): array
    {
        $apiKey = Env::get('DEEPSEEK_API_KEY');
        if (!$apiKey) {
            throw new \RuntimeException('DEEPSEEK_API_KEY não configurada no .env.');
        }
        $url   = Env::get('DEEPSEEK_API_URL', 'https://api.deepseek.com/chat/completions');
        $model = Env::get('DEEPSEEK_MODEL', 'deepseek-reasoner');

        $messages = PromptBuilder::build($id, $category, $term, $lang, $related);

        $payload = [
            'model'      => $model,
            'messages'   => $messages,
            'temperature'=> 0.9,
            'max_tokens' => 8000,
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                "Authorization: Bearer $apiKey",
            ],
            CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
            CURLOPT_TIMEOUT        => 300, // reasoner pode demorar
        ]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err  = curl_error($ch);
        curl_close($ch);

        if ($body === false) {
            throw new \RuntimeException("Falha de rede DeepSeek: $err");
        }
        if ($code < 200 || $code >= 300) {
            throw new \RuntimeException("DeepSeek HTTP $code: " . substr((string) $body, 0, 300));
        }

        $data = json_decode((string) $body, true);
        $content = $data['choices'][0]['message']['content'] ?? null;
        if (!is_string($content) || $content === '') {
            throw new \RuntimeException('Resposta DeepSeek sem content.');
        }

        return self::parseJson($content);
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
        $json = substr($s, $start, $end - $start + 1);
        $obj = json_decode($json, true);
        if (!is_array($obj)) {
            throw new \RuntimeException('JSON inválido na resposta da IA.');
        }
        return $obj;
    }
}
