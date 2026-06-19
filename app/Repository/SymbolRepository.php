<?php
declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;
use App\Support\Lang;

/** Acesso aos símbolos e seu conteúdo por idioma. */
final class SymbolRepository
{
    private const JSON_FIELDS = ['sections', 'variations', 'faq', 'semantic_keywords'];

    /** Lista símbolos publicáveis (reviewed/published) com o conteúdo de um idioma. */
    public function listLive(string $lang): array
    {
        $sql = 'SELECT s.id, c.slug, c.h1
                FROM symbols s
                JOIN symbol_content c ON c.symbol_id = s.id AND c.lang = ?
                WHERE s.status IN ("reviewed","published")
                ORDER BY c.h1 ASC';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute([$lang]);
        return $stmt->fetchAll();
    }

    /** Página pública por idioma + slug. Retorna null se não existir/for draft. */
    public function findBySlug(string $lang, string $slug): ?array
    {
        $sql = 'SELECT s.id, s.category, s.related, s.status, c.*
                FROM symbol_content c
                JOIN symbols s ON s.id = c.symbol_id
                WHERE c.lang = ? AND c.slug = ? AND s.status IN ("reviewed","published")
                LIMIT 1';
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute([$lang, $slug]);
        $row = $stmt->fetch();
        if (!$row) {
            return null;
        }
        return $this->hydrate($row);
    }

    /** Slugs do mesmo símbolo em todos os idiomas (para hreflang/alternates). */
    public function alternates(string $symbolId): array
    {
        $stmt = Database::pdo()->prepare('SELECT lang, slug FROM symbol_content WHERE symbol_id = ?');
        $stmt->execute([$symbolId]);
        $out = [];
        foreach ($stmt->fetchAll() as $r) {
            $out[$r['lang']] = '/' . $r['lang'] . '/' . $r['slug'];
        }
        return $out;
    }

    /** Links relacionados resolvidos no idioma dado. */
    public function relatedLinks(array $relatedIds, string $lang): array
    {
        if (!$relatedIds) {
            return [];
        }
        $in = implode(',', array_fill(0, count($relatedIds), '?'));
        $sql = "SELECT c.slug, c.h1 FROM symbol_content c
                JOIN symbols s ON s.id = c.symbol_id
                WHERE c.lang = ? AND c.symbol_id IN ($in) AND s.status IN ('reviewed','published')";
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute(array_merge([$lang], $relatedIds));
        return array_map(
            fn($r) => ['href' => "/$lang/{$r['slug']}", 'label' => $r['h1']],
            $stmt->fetchAll()
        );
    }

    // ---------------- Admin ----------------

    /** Todos os símbolos (qualquer status) para o painel. */
    public function listAll(): array
    {
        $sql = 'SELECT s.id, s.category, s.status, s.updated_at,
                       MAX(CASE WHEN c.lang="pt" THEN c.h1 END) AS h1_pt
                FROM symbols s
                LEFT JOIN symbol_content c ON c.symbol_id = s.id
                GROUP BY s.id, s.category, s.status, s.updated_at
                ORDER BY FIELD(s.status,"draft","reviewed","published"), s.updated_at DESC';
        return Database::pdo()->query($sql)->fetchAll();
    }

    /** Mapa id => status de todos os símbolos já criados. */
    public function statusMap(): array
    {
        $rows = Database::pdo()->query('SELECT id, status FROM symbols')->fetchAll();
        $out = [];
        foreach ($rows as $r) {
            $out[$r['id']] = $r['status'];
        }
        return $out;
    }

    public function find(string $id): ?array
    {
        $stmt = Database::pdo()->prepare('SELECT * FROM symbols WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        $sym = $stmt->fetch();
        if (!$sym) {
            return null;
        }
        $sym['related'] = $sym['related'] ? json_decode($sym['related'], true) : [];
        $cStmt = Database::pdo()->prepare('SELECT * FROM symbol_content WHERE symbol_id = ?');
        $cStmt->execute([$id]);
        $content = [];
        foreach ($cStmt->fetchAll() as $row) {
            $content[$row['lang']] = $this->hydrate($row);
        }
        $sym['content'] = $content;
        return $sym;
    }

    public function setStatus(string $id, string $status): void
    {
        $stmt = Database::pdo()->prepare('UPDATE symbols SET status = ? WHERE id = ?');
        $stmt->execute([$status, $id]);
    }

    /** Cria/atualiza o símbolo e seu conteúdo por idioma (upsert). */
    public function save(string $id, string $category, array $related, array $languages, ?string $model = null): void
    {
        $pdo = Database::pdo();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO symbols (id, category, related, model, generated_at)
                 VALUES (?,?,?,?,NOW())
                 ON DUPLICATE KEY UPDATE category=VALUES(category), related=VALUES(related),
                   model=VALUES(model), generated_at=NOW()'
            )->execute([$id, $category, json_encode(array_values($related), JSON_UNESCAPED_UNICODE), $model]);

            $sql = 'INSERT INTO symbol_content
                (symbol_id, lang, slug, title, meta_description, h1, quick_answer, intro,
                 sections, variations, faq, closing, semantic_keywords)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE
                 slug=VALUES(slug), title=VALUES(title), meta_description=VALUES(meta_description),
                 h1=VALUES(h1), quick_answer=VALUES(quick_answer), intro=VALUES(intro),
                 sections=VALUES(sections), variations=VALUES(variations), faq=VALUES(faq),
                 closing=VALUES(closing), semantic_keywords=VALUES(semantic_keywords)';
            $stmt = $pdo->prepare($sql);
            foreach ($languages as $lang => $c) {
                $stmt->execute([
                    $id, $lang, $c['slug'], $c['title'], $c['metaDescription'], $c['h1'],
                    $c['quickAnswer'], $c['intro'],
                    json_encode($c['sections'], JSON_UNESCAPED_UNICODE),
                    json_encode($c['variations'], JSON_UNESCAPED_UNICODE),
                    json_encode($c['faq'], JSON_UNESCAPED_UNICODE),
                    $c['closing'],
                    json_encode($c['semanticKeywords'], JSON_UNESCAPED_UNICODE),
                ]);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    /** Decodifica campos JSON de uma linha de symbol_content. */
    private function hydrate(array $row): array
    {
        foreach (self::JSON_FIELDS as $f) {
            if (isset($row[$f]) && is_string($row[$f])) {
                $row[$f] = json_decode($row[$f], true) ?? [];
            }
        }
        if (isset($row['related']) && is_string($row['related'])) {
            $row['related'] = json_decode($row['related'], true) ?? [];
        }
        return $row;
    }
}
