<?php
declare(strict_types=1);

namespace App\Service;

use App\Core\Env;

/** Busca de imagens no Pexels (hotlink do CDN deles). */
final class Pexels
{
    /**
     * Procura uma foto horizontal para o termo. Retorna null se não houver
     * chave configurada, erro de rede ou nenhum resultado.
     *
     * @param bool $random Se true, escolhe aleatoriamente entre os primeiros
     *                     resultados (para o botão "trocar imagem" variar).
     * @return array{url:string, photographer:string, photographer_url:string, page:string}|null
     */
    public static function search(string $query, bool $random = false): ?array
    {
        $key = Env::get('PEXELS_API_KEY');
        if (!$key || trim($query) === '') {
            return null;
        }
        $perPage = $random ? 15 : 1;
        $url = 'https://api.pexels.com/v1/search?orientation=landscape&per_page=' . $perPage
            . '&query=' . rawurlencode($query);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER     => ['Authorization: ' . $key],
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT        => 20,
        ]);
        $body = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false || $code < 200 || $code >= 300) {
            return null;
        }
        $data = json_decode((string) $body, true);
        $photos = $data['photos'] ?? [];
        if (!$photos) {
            return null;
        }
        $p = $random ? $photos[array_rand($photos)] : $photos[0];
        return [
            'url'              => $p['src']['large'] ?? ($p['src']['landscape'] ?? ($p['src']['original'] ?? '')),
            'photographer'     => (string) ($p['photographer'] ?? 'Pexels'),
            'photographer_url' => (string) ($p['photographer_url'] ?? 'https://www.pexels.com'),
            'page'             => (string) ($p['url'] ?? 'https://www.pexels.com'),
        ];
    }

    /** Tem chave configurada? */
    public static function enabled(): bool
    {
        return (bool) Env::get('PEXELS_API_KEY');
    }
}
