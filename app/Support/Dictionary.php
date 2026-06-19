<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Dicionário de símbolos de sonho por categoria.
 *
 * Cada item é um CONCEITO (rótulo em inglês, idioma-neutro). A IA decide, na
 * geração, a melhor forma de expressá-lo em cada idioma (pt/es/en) — você não
 * digita termos: só filtra e escolhe o que gerar.
 *
 * `id`  = chave kebab única (usada no banco e nas URLs internas).
 * `en`  = conceito em inglês, para a IA entender exatamente o símbolo.
 *
 * Lista inicial abrangente e facilmente extensível (basta adicionar linhas).
 */
final class Dictionary
{
    /** @var array<string, array<int, array{id:string, en:string}>> */
    private const DATA = [
        'animals' => [
            ['id' => 'snake', 'en' => 'snakes'],
            ['id' => 'dog', 'en' => 'a dog'],
            ['id' => 'cat', 'en' => 'a cat'],
            ['id' => 'spider', 'en' => 'spiders'],
            ['id' => 'lion', 'en' => 'a lion'],
            ['id' => 'rat', 'en' => 'rats or mice'],
            ['id' => 'cow', 'en' => 'a cow'],
            ['id' => 'horse', 'en' => 'a horse'],
            ['id' => 'bird', 'en' => 'birds'],
            ['id' => 'fish', 'en' => 'fish'],
            ['id' => 'shark', 'en' => 'a shark'],
            ['id' => 'bee', 'en' => 'bees'],
            ['id' => 'ant', 'en' => 'ants'],
            ['id' => 'cockroach', 'en' => 'cockroaches'],
            ['id' => 'scorpion', 'en' => 'a scorpion'],
            ['id' => 'frog', 'en' => 'a frog'],
            ['id' => 'lizard', 'en' => 'a lizard'],
            ['id' => 'bull', 'en' => 'a bull'],
            ['id' => 'pig', 'en' => 'a pig'],
            ['id' => 'chicken', 'en' => 'a chicken'],
            ['id' => 'owl', 'en' => 'an owl'],
            ['id' => 'eagle', 'en' => 'an eagle'],
            ['id' => 'wolf', 'en' => 'a wolf'],
            ['id' => 'bear', 'en' => 'a bear'],
            ['id' => 'elephant', 'en' => 'an elephant'],
            ['id' => 'monkey', 'en' => 'a monkey'],
            ['id' => 'crocodile', 'en' => 'a crocodile or alligator'],
            ['id' => 'turtle', 'en' => 'a turtle'],
            ['id' => 'butterfly', 'en' => 'a butterfly'],
            ['id' => 'fly', 'en' => 'flies'],
            ['id' => 'mosquito', 'en' => 'mosquitoes'],
            ['id' => 'bat', 'en' => 'a bat'],
            ['id' => 'dove', 'en' => 'a dove or pigeon'],
            ['id' => 'goat', 'en' => 'a goat'],
            ['id' => 'sheep', 'en' => 'sheep'],
            ['id' => 'fox', 'en' => 'a fox'],
            ['id' => 'whale', 'en' => 'a whale'],
            ['id' => 'dolphin', 'en' => 'a dolphin'],
            ['id' => 'crab', 'en' => 'a crab'],
            ['id' => 'worm', 'en' => 'worms'],
        ],
        'people' => [
            ['id' => 'ex-partner', 'en' => 'your ex (ex-boyfriend/girlfriend)'],
            ['id' => 'mother', 'en' => 'your mother'],
            ['id' => 'father', 'en' => 'your father'],
            ['id' => 'baby', 'en' => 'a baby'],
            ['id' => 'dead-relative', 'en' => 'a dead relative who is alive in the dream'],
            ['id' => 'stranger', 'en' => 'a stranger'],
            ['id' => 'child', 'en' => 'a child'],
            ['id' => 'friend', 'en' => 'a friend'],
            ['id' => 'enemy', 'en' => 'an enemy'],
            ['id' => 'boss', 'en' => 'your boss'],
            ['id' => 'pregnant-woman', 'en' => 'a pregnant woman'],
            ['id' => 'twins', 'en' => 'twins'],
            ['id' => 'celebrity', 'en' => 'a celebrity'],
            ['id' => 'police', 'en' => 'the police'],
            ['id' => 'thief', 'en' => 'a thief'],
            ['id' => 'doctor', 'en' => 'a doctor'],
            ['id' => 'husband', 'en' => 'your husband'],
            ['id' => 'wife', 'en' => 'your wife'],
            ['id' => 'grandmother', 'en' => 'your grandmother'],
            ['id' => 'grandfather', 'en' => 'your grandfather'],
            ['id' => 'crowd', 'en' => 'a crowd of people'],
            ['id' => 'old-friend', 'en' => 'an old friend'],
        ],
        'actions' => [
            ['id' => 'falling', 'en' => 'falling'],
            ['id' => 'flying', 'en' => 'flying'],
            ['id' => 'running', 'en' => 'running'],
            ['id' => 'being-chased', 'en' => 'being chased'],
            ['id' => 'drowning', 'en' => 'drowning'],
            ['id' => 'dying', 'en' => 'dying'],
            ['id' => 'crying', 'en' => 'crying'],
            ['id' => 'kissing', 'en' => 'kissing someone'],
            ['id' => 'fighting', 'en' => 'fighting'],
            ['id' => 'driving', 'en' => 'driving a car'],
            ['id' => 'swimming', 'en' => 'swimming'],
            ['id' => 'climbing', 'en' => 'climbing'],
            ['id' => 'getting-lost', 'en' => 'getting lost'],
            ['id' => 'naked-in-public', 'en' => 'being naked in public'],
            ['id' => 'giving-birth', 'en' => 'giving birth'],
            ['id' => 'being-late', 'en' => 'being late'],
            ['id' => 'missing-flight', 'en' => 'missing a flight'],
            ['id' => 'hiding', 'en' => 'hiding'],
            ['id' => 'being-trapped', 'en' => 'being trapped'],
            ['id' => 'escaping', 'en' => 'escaping danger'],
            ['id' => 'getting-married', 'en' => 'getting married'],
            ['id' => 'searching', 'en' => 'searching for something lost'],
        ],
        'objects' => [
            ['id' => 'money', 'en' => 'money'],
            ['id' => 'car', 'en' => 'a car'],
            ['id' => 'key', 'en' => 'a key'],
            ['id' => 'ring', 'en' => 'a ring'],
            ['id' => 'knife', 'en' => 'a knife'],
            ['id' => 'gun', 'en' => 'a gun'],
            ['id' => 'mirror', 'en' => 'a mirror'],
            ['id' => 'door', 'en' => 'a door'],
            ['id' => 'stairs', 'en' => 'stairs'],
            ['id' => 'bed', 'en' => 'a bed'],
            ['id' => 'clothes', 'en' => 'clothes'],
            ['id' => 'shoes', 'en' => 'shoes'],
            ['id' => 'clock', 'en' => 'a clock or watch'],
            ['id' => 'book', 'en' => 'a book'],
            ['id' => 'food', 'en' => 'food'],
            ['id' => 'bread', 'en' => 'bread'],
            ['id' => 'egg', 'en' => 'eggs'],
            ['id' => 'gold', 'en' => 'gold'],
            ['id' => 'jewelry', 'en' => 'jewelry'],
            ['id' => 'wallet', 'en' => 'a wallet'],
            ['id' => 'bag', 'en' => 'a bag or purse'],
            ['id' => 'boat', 'en' => 'a boat'],
            ['id' => 'plane', 'en' => 'an airplane'],
            ['id' => 'train', 'en' => 'a train'],
            ['id' => 'candle', 'en' => 'a candle'],
            ['id' => 'photograph', 'en' => 'a photograph'],
            ['id' => 'letter', 'en' => 'a letter'],
            ['id' => 'toilet', 'en' => 'a toilet'],
            ['id' => 'phone', 'en' => 'a phone'],
        ],
        'places' => [
            ['id' => 'house', 'en' => 'a house'],
            ['id' => 'school', 'en' => 'school'],
            ['id' => 'hospital', 'en' => 'a hospital'],
            ['id' => 'church', 'en' => 'a church'],
            ['id' => 'beach', 'en' => 'the beach'],
            ['id' => 'forest', 'en' => 'a forest'],
            ['id' => 'cemetery', 'en' => 'a cemetery'],
            ['id' => 'bridge', 'en' => 'a bridge'],
            ['id' => 'road', 'en' => 'a road'],
            ['id' => 'prison', 'en' => 'a prison'],
            ['id' => 'work', 'en' => 'your workplace'],
            ['id' => 'supermarket', 'en' => 'a supermarket'],
            ['id' => 'elevator', 'en' => 'an elevator'],
            ['id' => 'basement', 'en' => 'a basement'],
            ['id' => 'garden', 'en' => 'a garden'],
            ['id' => 'desert', 'en' => 'a desert'],
            ['id' => 'island', 'en' => 'an island'],
            ['id' => 'cave', 'en' => 'a cave'],
            ['id' => 'airport', 'en' => 'an airport'],
        ],
        'feelings' => [
            ['id' => 'fear', 'en' => 'feeling intense fear'],
            ['id' => 'happiness', 'en' => 'feeling happy'],
            ['id' => 'sadness', 'en' => 'feeling deep sadness'],
            ['id' => 'anger', 'en' => 'feeling anger'],
            ['id' => 'love', 'en' => 'feeling love'],
            ['id' => 'anxiety', 'en' => 'feeling anxiety'],
            ['id' => 'guilt', 'en' => 'feeling guilt'],
            ['id' => 'jealousy', 'en' => 'feeling jealousy'],
            ['id' => 'loneliness', 'en' => 'feeling lonely'],
            ['id' => 'shame', 'en' => 'feeling shame'],
        ],
        'events' => [
            ['id' => 'wedding', 'en' => 'a wedding'],
            ['id' => 'death', 'en' => 'death'],
            ['id' => 'birth', 'en' => 'a birth'],
            ['id' => 'funeral', 'en' => 'a funeral'],
            ['id' => 'accident', 'en' => 'an accident'],
            ['id' => 'war', 'en' => 'war'],
            ['id' => 'party', 'en' => 'a party'],
            ['id' => 'exam', 'en' => 'an exam or test'],
            ['id' => 'pregnancy', 'en' => 'pregnancy'],
            ['id' => 'graduation', 'en' => 'a graduation'],
            ['id' => 'divorce', 'en' => 'a divorce'],
            ['id' => 'moving-house', 'en' => 'moving to a new house'],
            ['id' => 'flood', 'en' => 'a flood'],
            ['id' => 'earthquake', 'en' => 'an earthquake'],
            ['id' => 'robbery', 'en' => 'a robbery'],
            ['id' => 'betrayal', 'en' => 'betrayal'],
            ['id' => 'job-interview', 'en' => 'a job interview'],
            ['id' => 'breakup', 'en' => 'a breakup'],
        ],
        'body' => [
            ['id' => 'tooth-falling', 'en' => 'teeth falling out'],
            ['id' => 'hair', 'en' => 'hair'],
            ['id' => 'blood', 'en' => 'blood'],
            ['id' => 'eyes', 'en' => 'eyes'],
            ['id' => 'hands', 'en' => 'hands'],
            ['id' => 'feet', 'en' => 'feet'],
            ['id' => 'nails', 'en' => 'fingernails'],
            ['id' => 'face', 'en' => 'a face'],
            ['id' => 'heart', 'en' => 'the heart'],
            ['id' => 'broken-bone', 'en' => 'a broken bone'],
            ['id' => 'vomiting', 'en' => 'vomiting'],
            ['id' => 'pregnant-belly', 'en' => 'being pregnant (a pregnant belly)'],
        ],
        'nature' => [
            ['id' => 'water', 'en' => 'water'],
            ['id' => 'fire', 'en' => 'fire'],
            ['id' => 'rain', 'en' => 'rain'],
            ['id' => 'storm', 'en' => 'a storm'],
            ['id' => 'snow', 'en' => 'snow'],
            ['id' => 'sea', 'en' => 'the sea'],
            ['id' => 'sun', 'en' => 'the sun'],
            ['id' => 'moon', 'en' => 'the moon'],
            ['id' => 'stars', 'en' => 'stars'],
            ['id' => 'tree', 'en' => 'a tree'],
            ['id' => 'flowers', 'en' => 'flowers'],
            ['id' => 'wind', 'en' => 'wind'],
            ['id' => 'lightning', 'en' => 'lightning'],
            ['id' => 'mountain', 'en' => 'a mountain'],
            ['id' => 'river', 'en' => 'a river'],
            ['id' => 'ice', 'en' => 'ice'],
            ['id' => 'fog', 'en' => 'fog'],
            ['id' => 'volcano', 'en' => 'a volcano'],
        ],
        'spiritual' => [
            ['id' => 'god', 'en' => 'God'],
            ['id' => 'angel', 'en' => 'an angel'],
            ['id' => 'devil', 'en' => 'the devil'],
            ['id' => 'ghost', 'en' => 'a ghost'],
            ['id' => 'praying', 'en' => 'praying'],
            ['id' => 'demon', 'en' => 'a demon'],
            ['id' => 'soul', 'en' => 'a soul or spirit'],
            ['id' => 'heaven', 'en' => 'heaven'],
            ['id' => 'hell', 'en' => 'hell'],
            ['id' => 'light', 'en' => 'a bright light'],
            ['id' => 'witch', 'en' => 'a witch'],
            ['id' => 'cross', 'en' => 'a cross'],
        ],
    ];

    /** @return string[] */
    public static function categories(): array
    {
        return array_keys(self::DATA);
    }

    /** Itens agrupados por categoria: ['animals' => [['id'=>..,'en'=>..], ...], ...]. */
    public static function grouped(): array
    {
        return self::DATA;
    }

    /** Todos os itens como lista plana com a categoria embutida. */
    public static function all(): array
    {
        $out = [];
        foreach (self::DATA as $cat => $items) {
            foreach ($items as $it) {
                $out[] = ['id' => $it['id'], 'en' => $it['en'], 'category' => $cat];
            }
        }
        return $out;
    }

    public static function find(string $id): ?array
    {
        foreach (self::all() as $it) {
            if ($it['id'] === $id) {
                return $it;
            }
        }
        return null;
    }

    /** Até $n irmãos da mesma categoria (para links internos relacionados). */
    public static function siblings(string $id, int $n = 3): array
    {
        $item = self::find($id);
        if (!$item) {
            return [];
        }
        $siblings = [];
        foreach (self::DATA[$item['category']] as $it) {
            if ($it['id'] !== $id) {
                $siblings[] = $it['id'];
            }
        }
        shuffle($siblings);
        return array_slice($siblings, 0, $n);
    }

    public static function count(): int
    {
        return count(self::all());
    }
}
