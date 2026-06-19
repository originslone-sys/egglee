# Criar o usuário admin

A senha é guardada como **hash** (nunca em texto puro). Gere o hash e insira.

## Opção PHP (recomendado na Hostinger)

```php
<?php echo password_hash('SUA_SENHA_FORTE', PASSWORD_DEFAULT), "\n";
```

## Opção Node

```bash
node -e "import('bcryptjs').then(b=>console.log(b.hashSync('SUA_SENHA_FORTE',12)))"
```

## Inserir no banco (phpMyAdmin ou mysql CLI)

```sql
INSERT INTO admin_users (username, password_hash, role)
VALUES ('admin', '<COLE_O_HASH_AQUI>', 'admin');
```

> Use uma senha longa e única. Troque as credenciais MySQL no hPanel se
> elas já tiverem trafegado por canais não seguros.
