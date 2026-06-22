<?php
declare(strict_types=1);

namespace App\Repository;

use App\Core\Database;
use App\Support\Lang;

/** Acesso aos símbolos e seu conteúdo por idioma. */
final class SymbolRepository
{
    private const JSON_FIELDS = ['sections', 'variations', 'faq', 'semantic_keywords', 'table_data'];

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

    /** Cards (href, h1, categoria, imagem) — base reutilizável. */
    private function cards(string $where, array $params, string $lang, int $limit = 0, string $order = 'c.h1 ASC'): array
    {
        $lim = $limit > 0 ? ' LIMIT ' . (int) $limit : '';
        $sql = "SELECT s.id, s.category, c.slug, c.h1, s.image_url
                FROM symbols s
                JOIN symbol_content c ON c.symbol_id = s.id AND c.lang = ?
                WHERE s.status IN ('reviewed','published') $where
                ORDER BY $order$lim";
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute(array_merge([$lang], $params));
        return array_map(fn($r) => [
            'href'  => "/$lang/{$r['slug']}",
            'h1'    => $r['h1'],
            'category' => $r['category'],
            'image' => $r['image_url'] ?? null,
        ], $stmt->fetchAll());
    }

    /** Artigos de uma categoria. */
    public function listByCategory(string $lang, string $category, int $limit = 0): array
    {
        return $this->cards('AND s.category = ?', [$category], $lang, $limit);
    }

    /** Mais recentes. */
    public function recent(string $lang, int $limit = 8): array
    {
        return $this->cards('', [], $lang, $limit, 's.updated_at DESC');
    }

    /** Outros artigos da mesma categoria (para o fim do artigo). */
    public function relatedArticles(string $lang, string $category, string $excludeId, int $limit = 6): array
    {
        return $this->cards('AND s.category = ? AND s.id <> ?', [$category, $excludeId], $lang, $limit, 'RAND()');
    }

    /** Busca por palavra no título/keywords/resumo. */
    public function search(string $lang, string $q, int $limit = 40): array
    {
        $like = '%' . $q . '%';
        return $this->cards(
            'AND (c.h1 LIKE ? OR c.title LIKE ? OR c.quick_answer LIKE ? OR c.semantic_keywords LIKE ?)',
            [$like, $like, $like, $like],
            $lang,
            $limit
        );
    }

    /** Contagem de artigos por categoria (para o índice). */
    public function categoryCounts(string $lang): array
    {
        $sql = "SELECT s.category, COUNT(*) AS n
                FROM symbols s
                JOIN symbol_content c ON c.symbol_id = s.id AND c.lang = ?
                WHERE s.status IN ('reviewed','published')
                GROUP BY s.category";
        $stmt = Database::pdo()->prepare($sql);
        $stmt->execute([$lang]);
        $out = [];
        foreach ($stmt->fetchAll() as $r) {
            $out[$r['category']] = (int) $r['n'];
        }
        return $out;
    }

    /** Página pública por idioma + slug. Retorna null se não existir/for draft. */
    public function findBySlug(string $lang, string $slug): ?array
    {
        // s.*, c.* para ser resiliente a colunas novas (image_*, table_data)
        // mesmo que a migração ainda não tenha rodado num banco antigo.
        $sql = 'SELECT s.*, c.*
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

    /** Símbolos para o painel (paginado). */
    public function listAll(int $limit = 50, int $offset = 0): array
    {
        $sql = 'SELECT s.id, s.category, s.status, s.updated_at,
                       MAX(CASE WHEN c.lang="pt" THEN c.h1 END) AS h1_pt
                FROM symbols s
                LEFT JOIN symbol_content c ON c.symbol_id = s.id
                GROUP BY s.id, s.category, s.status, s.updated_at
                ORDER BY FIELD(s.status,"draft","reviewed","published"), s.updated_at DESC
                LIMIT ' . max(1, $limit) . ' OFFSET ' . max(0, $offset);
        return Database::pdo()->query($sql)->fetchAll();
    }

    /** Total de símbolos (para paginação). */
    public function countAll(): int
    {
        return (int) Database::pdo()->query('SELECT COUNT(*) FROM symbols')->fetchColumn();
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

    /** IDs de símbolos já gerados (têm pelo menos 1 idioma). */
    public function generatedIds(): array
    {
        $rows = Database::pdo()->query(
            'SELECT DISTINCT symbol_id FROM symbol_content'
        )->fetchAll();
        return array_map(fn($r) => $r['symbol_id'], $rows);
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

    /**
     * "Toca" a data dos artigos publicados/revisados mais antigos que $days dias,
     * gravando AGORA em updated_at — assim o site nunca exibe datas muito antigas.
     * Retorna quantos artigos foram atualizados.
     */
    public function refreshStaleDates(int $days = 30, int $limit = 500): int
    {
        $pdo = Database::pdo();
        $sel = $pdo->prepare(
            "SELECT id FROM symbols
             WHERE status IN ('reviewed','published')
               AND updated_at < (NOW() - INTERVAL ? DAY)
             ORDER BY updated_at ASC
             LIMIT " . max(1, $limit)
        );
        $sel->execute([max(0, $days)]);
        $ids = array_map(fn($r) => $r['id'], $sel->fetchAll());
        if (!$ids) {
            return 0;
        }
        $in = implode(',', array_fill(0, count($ids), '?'));
        $pdo->prepare("UPDATE symbols SET updated_at = NOW() WHERE id IN ($in)")->execute($ids);
        $pdo->prepare("UPDATE symbol_content SET updated_at = NOW() WHERE symbol_id IN ($in)")->execute($ids);
        return count($ids);
    }

    /** Exclui o símbolo (o conteúdo por idioma cai junto via ON DELETE CASCADE). */
    public function delete(string $id): void
    {
        Database::pdo()->prepare('DELETE FROM symbols WHERE id = ?')->execute([$id]);
    }

    /** URL da imagem atual do símbolo (ou null). */
    public function imageUrl(string $id): ?string
    {
        $stmt = Database::pdo()->prepare('SELECT image_url FROM symbols WHERE id = ?');
        $stmt->execute([$id]);
        $v = $stmt->fetchColumn();
        return $v ? (string) $v : null;
    }

    /** Define a imagem (hotlink do Pexels) do símbolo. */
    public function setImage(string $id, array $img): void
    {
        Database::pdo()->prepare(
            'UPDATE symbols SET image_url=?, image_photographer=?, image_photographer_url=?, image_page=? WHERE id=?'
        )->execute([$img['url'], $img['photographer'], $img['photographer_url'], $img['page'], $id]);
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
                 sections, variations, faq, closing, table_data, semantic_keywords)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON DUPLICATE KEY UPDATE
                 slug=VALUES(slug), title=VALUES(title), meta_description=VALUES(meta_description),
                 h1=VALUES(h1), quick_answer=VALUES(quick_answer), intro=VALUES(intro),
                 sections=VALUES(sections), variations=VALUES(variations), faq=VALUES(faq),
                 closing=VALUES(closing), table_data=VALUES(table_data), semantic_keywords=VALUES(semantic_keywords)';
            $stmt = $pdo->prepare($sql);
            foreach ($languages as $lang => $c) {
                $stmt->execute([
                    $id, $lang, $c['slug'], $c['title'], $c['metaDescription'], $c['h1'],
                    $c['quickAnswer'], $c['intro'],
                    json_encode($c['sections'], JSON_UNESCAPED_UNICODE),
                    json_encode($c['variations'], JSON_UNESCAPED_UNICODE),
                    json_encode($c['faq'], JSON_UNESCAPED_UNICODE),
                    $c['closing'],
                    json_encode($c['table'] ?? null, JSON_UNESCAPED_UNICODE),
                    json_encode($c['semanticKeywords'], JSON_UNESCAPED_UNICODE),
                ]);
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    // ---------------- Geração incremental (1 idioma por vez) ----------------

    /** Idiomas já gerados para um símbolo. */
    public function langsFor(string $id): array
    {
        $stmt = Database::pdo()->prepare('SELECT lang FROM symbol_content WHERE symbol_id = ?');
        $stmt->execute([$id]);
        return array_map(fn($r) => $r['lang'], $stmt->fetchAll());
    }

    /** Cria a linha do símbolo se não existir (sem mexer no status atual). */
    public function ensureSymbol(string $id, string $category, array $related, ?string $model = null, ?string $parentId = null): void
    {
        Database::pdo()->prepare(
            'INSERT INTO symbols (id, category, related, model, parent_id, generated_at)
             VALUES (?,?,?,?,?,NOW())
             ON DUPLICATE KEY UPDATE category=VALUES(category), related=VALUES(related),
               model=VALUES(model), parent_id=VALUES(parent_id), generated_at=NOW()'
        )->execute([$id, $category, json_encode(array_values($related), JSON_UNESCAPED_UNICODE), $model, $parentId]);
    }

    /** Card de um símbolo específico por idioma (ou null se não estiver no ar). */
    public function cardById(string $id, string $lang): ?array
    {
        $cards = $this->cards('AND s.id = ?', [$id], $lang, 1);
        return $cards[0] ?? null;
    }

    /** Variações (filhas) de um símbolo, no idioma dado. */
    public function childrenCards(string $parentId, string $lang): array
    {
        return $this->cards('AND s.parent_id = ?', [$parentId], $lang, 0, 'c.h1 ASC');
    }

    /** Upsert do conteúdo de UM idioma. */
    public function saveLanguage(string $id, string $lang, array $c): void
    {
        Database::pdo()->prepare(
            'INSERT INTO symbol_content
                (symbol_id, lang, slug, title, meta_description, h1, quick_answer, intro,
                 sections, variations, faq, closing, table_data, semantic_keywords)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
                 slug=VALUES(slug), title=VALUES(title), meta_description=VALUES(meta_description),
                 h1=VALUES(h1), quick_answer=VALUES(quick_answer), intro=VALUES(intro),
                 sections=VALUES(sections), variations=VALUES(variations), faq=VALUES(faq),
                 closing=VALUES(closing), table_data=VALUES(table_data), semantic_keywords=VALUES(semantic_keywords)'
        )->execute([
            $id, $lang, $c['slug'], $c['title'], $c['metaDescription'], $c['h1'],
            $c['quickAnswer'], $c['intro'],
            json_encode($c['sections'], JSON_UNESCAPED_UNICODE),
            json_encode($c['variations'], JSON_UNESCAPED_UNICODE),
            json_encode($c['faq'], JSON_UNESCAPED_UNICODE),
            $c['closing'],
            json_encode($c['table'] ?? null, JSON_UNESCAPED_UNICODE),
            json_encode($c['semanticKeywords'], JSON_UNESCAPED_UNICODE),
        ]);
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
