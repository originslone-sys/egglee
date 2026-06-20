-- ============================================================
-- egglee — schema MySQL (utf8mb4)
-- ============================================================
-- Na Hostinger, o BANCO e o USUÁRIO já são criados pelo hPanel
-- (você já tem u740938289_egg / u740938289_egg_user). A linha de
-- CREATE DATABASE abaixo fica como referência; em shared hosting o
-- usuário normalmente NÃO tem privilégio para criá-lo via SQL.
--
-- CREATE DATABASE IF NOT EXISTS `u740938289_egg`
--   CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `u740938289_egg`;
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ---- Símbolos (1 linha por sonho, idioma-neutro) ----
CREATE TABLE IF NOT EXISTS `symbols` (
  `id`           VARCHAR(64)  NOT NULL,                 -- ex: "snake"
  `category`     VARCHAR(32)  NOT NULL,                 -- animals, body, nature...
  `related`      JSON         NULL,                     -- ["spider","rat"]
  `status`       ENUM('draft','reviewed','published') NOT NULL DEFAULT 'draft',
  `model`        VARCHAR(64)  NULL,
  `image_url`              VARCHAR(500) NULL,
  `image_photographer`     VARCHAR(190) NULL,
  `image_photographer_url` VARCHAR(500) NULL,
  `image_page`             VARCHAR(500) NULL,
  `generated_at` DATETIME     NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Conteúdo por idioma (1 linha por símbolo + idioma) ----
CREATE TABLE IF NOT EXISTS `symbol_content` (
  `symbol_id`        VARCHAR(64) NOT NULL,
  `lang`             ENUM('pt','es','en') NOT NULL,
  `slug`             VARCHAR(191) NOT NULL,
  `title`            VARCHAR(255) NOT NULL,
  `meta_description` VARCHAR(255) NOT NULL,
  `h1`               VARCHAR(255) NOT NULL,
  `quick_answer`     TEXT NOT NULL,
  `intro`            TEXT NOT NULL,
  `sections`         JSON NOT NULL,   -- [{heading, body}]
  `variations`       JSON NOT NULL,   -- [{keyword, meaning}]
  `faq`              JSON NOT NULL,   -- [{question, answer}]
  `closing`          TEXT NOT NULL,
  `table_data`       JSON NULL,       -- tabela comparativa (ex: por cor/tipo)
  `semantic_keywords` JSON NOT NULL,  -- ["...","..."]
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`symbol_id`, `lang`),
  UNIQUE KEY `uniq_lang_slug` (`lang`, `slug`),
  CONSTRAINT `fk_content_symbol` FOREIGN KEY (`symbol_id`)
    REFERENCES `symbols`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Usuários do painel admin ----
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username`      VARCHAR(64)  NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,   -- bcrypt/argon2 — NUNCA texto puro
  `role`          ENUM('admin','editor') NOT NULL DEFAULT 'admin',
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Log de geração (auditoria de custo/erros da IA) ----
CREATE TABLE IF NOT EXISTS `generation_log` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `symbol_id`  VARCHAR(64) NULL,
  `lang`       ENUM('pt','es','en') NULL,
  `model`      VARCHAR(64) NULL,
  `ok`         TINYINT(1) NOT NULL DEFAULT 0,
  `error`      TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_symbol` (`symbol_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Fila de geração (admin enfileira, worker/cron processa) ----
CREATE TABLE IF NOT EXISTS `generation_queue` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `concept_id` VARCHAR(64)  NOT NULL,
  `category`   VARCHAR(32)  NOT NULL,
  `en`         VARCHAR(255) NOT NULL,
  `status`     ENUM('pending','processing','done','error') NOT NULL DEFAULT 'pending',
  `attempts`   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `error`      TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_concept` (`concept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
