<?php
declare(strict_types=1);

namespace App\Support;

/**
 * Dicionário de símbolos de sonho por categoria.
 *
 * Cada item é um CONCEITO ÚNICO (rótulo em inglês, idioma-neutro). A IA decide,
 * na geração, a melhor forma de expressá-lo em cada idioma (pt/es/en).
 *
 * `id` = chave kebab única (usada no banco e nas URLs internas) — NÃO repita.
 * `en` = conceito em inglês, para a IA entender exatamente o símbolo.
 *
 * Fase 1: base ampla de conceitos ÚNICOS (sem variações). Variações
 * (cor/tamanho/ação) virão como páginas-filhas numa fase posterior.
 */
final class Dictionary
{
    /** @var array<string, array<int, array{id:string, en:string}>> */
    private const DATA = [
        'animals' => [
            ['id'=>'snake','en'=>'snakes'],['id'=>'dog','en'=>'a dog'],['id'=>'cat','en'=>'a cat'],
            ['id'=>'spider','en'=>'spiders'],['id'=>'lion','en'=>'a lion'],['id'=>'tiger','en'=>'a tiger'],
            ['id'=>'leopard','en'=>'a leopard'],['id'=>'panther','en'=>'a black panther'],['id'=>'jaguar','en'=>'a jaguar'],
            ['id'=>'rat','en'=>'rats or mice'],['id'=>'cow','en'=>'a cow'],['id'=>'ox','en'=>'an ox'],
            ['id'=>'horse','en'=>'a horse'],['id'=>'donkey','en'=>'a donkey'],['id'=>'mule','en'=>'a mule'],
            ['id'=>'bird','en'=>'birds'],['id'=>'fish','en'=>'fish'],['id'=>'shark','en'=>'a shark'],
            ['id'=>'whale','en'=>'a whale'],['id'=>'dolphin','en'=>'a dolphin'],['id'=>'octopus','en'=>'an octopus'],
            ['id'=>'crab','en'=>'a crab'],['id'=>'lobster','en'=>'a lobster'],['id'=>'shrimp','en'=>'shrimp'],
            ['id'=>'jellyfish','en'=>'a jellyfish'],['id'=>'eel','en'=>'an eel'],['id'=>'turtle','en'=>'a turtle'],
            ['id'=>'bee','en'=>'bees'],['id'=>'wasp','en'=>'wasps'],['id'=>'ant','en'=>'ants'],
            ['id'=>'cockroach','en'=>'cockroaches'],['id'=>'fly','en'=>'flies'],['id'=>'mosquito','en'=>'mosquitoes'],
            ['id'=>'butterfly','en'=>'a butterfly'],['id'=>'moth','en'=>'a moth'],['id'=>'caterpillar','en'=>'a caterpillar'],
            ['id'=>'worm','en'=>'worms'],['id'=>'snail','en'=>'a snail'],['id'=>'scorpion','en'=>'a scorpion'],
            ['id'=>'frog','en'=>'a frog'],['id'=>'toad','en'=>'a toad'],['id'=>'lizard','en'=>'a lizard'],
            ['id'=>'gecko','en'=>'a gecko'],['id'=>'iguana','en'=>'an iguana'],['id'=>'crocodile','en'=>'a crocodile or alligator'],
            ['id'=>'bull','en'=>'a bull'],['id'=>'pig','en'=>'a pig'],['id'=>'sheep','en'=>'sheep'],
            ['id'=>'goat','en'=>'a goat'],['id'=>'rabbit','en'=>'a rabbit'],['id'=>'hamster','en'=>'a hamster'],
            ['id'=>'squirrel','en'=>'a squirrel'],['id'=>'mole','en'=>'a mole'],['id'=>'bat','en'=>'a bat'],
            ['id'=>'chicken','en'=>'a chicken'],['id'=>'rooster','en'=>'a rooster'],['id'=>'duck','en'=>'a duck'],
            ['id'=>'goose','en'=>'a goose'],['id'=>'turkey','en'=>'a turkey'],['id'=>'owl','en'=>'an owl'],
            ['id'=>'eagle','en'=>'an eagle'],['id'=>'hawk','en'=>'a hawk'],['id'=>'vulture','en'=>'a vulture'],
            ['id'=>'crow','en'=>'a crow or raven'],['id'=>'dove','en'=>'a dove or pigeon'],['id'=>'sparrow','en'=>'a sparrow'],
            ['id'=>'parrot','en'=>'a parrot'],['id'=>'peacock','en'=>'a peacock'],['id'=>'swan','en'=>'a swan'],
            ['id'=>'flamingo','en'=>'a flamingo'],['id'=>'penguin','en'=>'a penguin'],['id'=>'ostrich','en'=>'an ostrich'],
            ['id'=>'wolf','en'=>'a wolf'],['id'=>'fox','en'=>'a fox'],['id'=>'bear','en'=>'a bear'],
            ['id'=>'elephant','en'=>'an elephant'],['id'=>'giraffe','en'=>'a giraffe'],['id'=>'zebra','en'=>'a zebra'],
            ['id'=>'rhino','en'=>'a rhinoceros'],['id'=>'hippo','en'=>'a hippopotamus'],['id'=>'camel','en'=>'a camel'],
            ['id'=>'monkey','en'=>'a monkey'],['id'=>'gorilla','en'=>'a gorilla'],['id'=>'deer','en'=>'a deer'],
            ['id'=>'kangaroo','en'=>'a kangaroo'],['id'=>'raccoon','en'=>'a raccoon'],['id'=>'hedgehog','en'=>'a hedgehog'],
            ['id'=>'seal','en'=>'a seal'],['id'=>'dragon','en'=>'a dragon'],['id'=>'dinosaur','en'=>'a dinosaur'],
            ['id'=>'dragonfly','en'=>'a dragonfly'],['id'=>'cricket','en'=>'a cricket'],['id'=>'beetle','en'=>'a beetle'],
            ['id'=>'ladybug','en'=>'a ladybug'],['id'=>'tarantula','en'=>'a tarantula'],['id'=>'centipede','en'=>'a centipede'],
            ['id'=>'boar','en'=>'a wild boar'],['id'=>'buffalo','en'=>'a buffalo'],['id'=>'cheetah','en'=>'a cheetah'],
            ['id'=>'panda','en'=>'a panda'],['id'=>'koala','en'=>'a koala'],['id'=>'sloth','en'=>'a sloth'],
            ['id'=>'llama','en'=>'a llama'],['id'=>'porcupine','en'=>'a porcupine'],['id'=>'armadillo','en'=>'an armadillo'],
            ['id'=>'chimpanzee','en'=>'a chimpanzee'],['id'=>'mongoose','en'=>'a mongoose'],['id'=>'weasel','en'=>'a weasel'],
            ['id'=>'goldfish','en'=>'a goldfish'],['id'=>'catfish','en'=>'a catfish'],['id'=>'piranha','en'=>'piranhas'],
            ['id'=>'starfish','en'=>'a starfish'],['id'=>'seahorse','en'=>'a seahorse'],['id'=>'oyster','en'=>'an oyster'],
            ['id'=>'anaconda','en'=>'an anaconda'],['id'=>'python','en'=>'a python'],['id'=>'rattlesnake','en'=>'a rattlesnake'],
            ['id'=>'viper','en'=>'a viper'],['id'=>'salamander','en'=>'a salamander'],['id'=>'mantis','en'=>'a praying mantis'],
            ['id'=>'grasshopper','en'=>'a grasshopper'],['id'=>'locust','en'=>'a swarm of locusts'],['id'=>'leech','en'=>'leeches'],
            ['id'=>'maggot','en'=>'maggots'],['id'=>'tick','en'=>'ticks'],['id'=>'flea','en'=>'fleas'],
        ],
        'people' => [
            ['id'=>'ex-partner','en'=>'your ex (ex-boyfriend/girlfriend)'],['id'=>'mother','en'=>'your mother'],
            ['id'=>'father','en'=>'your father'],['id'=>'baby','en'=>'a baby'],['id'=>'newborn','en'=>'a newborn baby'],
            ['id'=>'dead-relative','en'=>'a dead relative who is alive in the dream'],['id'=>'stranger','en'=>'a stranger'],
            ['id'=>'child','en'=>'a child'],['id'=>'friend','en'=>'a friend'],['id'=>'old-friend','en'=>'an old friend'],
            ['id'=>'enemy','en'=>'an enemy'],['id'=>'boss','en'=>'your boss'],['id'=>'coworker','en'=>'a coworker'],
            ['id'=>'neighbor','en'=>'a neighbor'],['id'=>'pregnant-woman','en'=>'a pregnant woman'],['id'=>'twins','en'=>'twins'],
            ['id'=>'celebrity','en'=>'a celebrity'],['id'=>'police','en'=>'the police'],['id'=>'thief','en'=>'a thief'],
            ['id'=>'doctor','en'=>'a doctor'],['id'=>'nurse','en'=>'a nurse'],['id'=>'teacher','en'=>'a teacher'],
            ['id'=>'soldier','en'=>'a soldier'],['id'=>'priest','en'=>'a priest'],['id'=>'husband','en'=>'your husband'],
            ['id'=>'wife','en'=>'your wife'],['id'=>'girlfriend','en'=>'your girlfriend'],['id'=>'boyfriend','en'=>'your boyfriend'],
            ['id'=>'grandmother','en'=>'your grandmother'],['id'=>'grandfather','en'=>'your grandfather'],
            ['id'=>'brother','en'=>'your brother'],['id'=>'sister','en'=>'your sister'],['id'=>'son','en'=>'your son'],
            ['id'=>'daughter','en'=>'your daughter'],['id'=>'aunt','en'=>'your aunt'],['id'=>'uncle','en'=>'your uncle'],
            ['id'=>'cousin','en'=>'your cousin'],['id'=>'mother-in-law','en'=>'your mother-in-law'],
            ['id'=>'crowd','en'=>'a crowd of people'],['id'=>'king','en'=>'a king'],['id'=>'queen','en'=>'a queen'],
            ['id'=>'beggar','en'=>'a beggar'],['id'=>'clown','en'=>'a clown'],['id'=>'fortune-teller','en'=>'a fortune teller'],
            ['id'=>'prisoner','en'=>'a prisoner'],['id'=>'widow','en'=>'a widow'],['id'=>'twin-flame','en'=>'a soulmate'],
            ['id'=>'best-friend','en'=>'your best friend'],['id'=>'lover','en'=>'a secret lover'],['id'=>'rival','en'=>'a rival'],
            ['id'=>'firefighter','en'=>'a firefighter'],['id'=>'judge','en'=>'a judge'],['id'=>'lawyer','en'=>'a lawyer'],
            ['id'=>'pilot','en'=>'a pilot'],['id'=>'sailor','en'=>'a sailor'],['id'=>'farmer','en'=>'a farmer'],
            ['id'=>'magician','en'=>'a magician'],['id'=>'singer','en'=>'a singer'],['id'=>'athlete','en'=>'an athlete'],
            ['id'=>'nun','en'=>'a nun'],['id'=>'monk','en'=>'a monk'],['id'=>'dentist','en'=>'a dentist'],
            ['id'=>'barber','en'=>'a barber or hairdresser'],['id'=>'mailman','en'=>'a mail carrier'],['id'=>'gravedigger','en'=>'a gravedigger'],
            ['id'=>'yourself-child','en'=>'yourself as a child'],['id'=>'older-self','en'=>'yourself as an old person'],
            ['id'=>'identical-you','en'=>'a double of yourself'],['id'=>'dead-friend','en'=>'a deceased friend'],
            ['id'=>'group-children','en'=>'many children'],['id'=>'famous-singer','en'=>'a famous singer'],
        ],
        'actions' => [
            ['id'=>'falling','en'=>'falling'],['id'=>'flying','en'=>'flying'],['id'=>'running','en'=>'running'],
            ['id'=>'being-chased','en'=>'being chased'],['id'=>'drowning','en'=>'drowning'],['id'=>'dying','en'=>'dying'],
            ['id'=>'crying','en'=>'crying'],['id'=>'laughing','en'=>'laughing'],['id'=>'screaming','en'=>'screaming'],
            ['id'=>'kissing','en'=>'kissing someone'],['id'=>'hugging','en'=>'hugging someone'],['id'=>'fighting','en'=>'fighting'],
            ['id'=>'driving','en'=>'driving a car'],['id'=>'swimming','en'=>'swimming'],['id'=>'climbing','en'=>'climbing'],
            ['id'=>'jumping','en'=>'jumping'],['id'=>'dancing','en'=>'dancing'],['id'=>'singing','en'=>'singing'],
            ['id'=>'walking','en'=>'walking'],['id'=>'getting-lost','en'=>'getting lost'],['id'=>'naked-in-public','en'=>'being naked in public'],
            ['id'=>'giving-birth','en'=>'giving birth'],['id'=>'being-late','en'=>'being late'],['id'=>'missing-flight','en'=>'missing a flight'],
            ['id'=>'hiding','en'=>'hiding'],['id'=>'being-trapped','en'=>'being trapped'],['id'=>'escaping','en'=>'escaping danger'],
            ['id'=>'getting-married','en'=>'getting married'],['id'=>'searching','en'=>'searching for something lost'],
            ['id'=>'eating','en'=>'eating'],['id'=>'drinking','en'=>'drinking water'],['id'=>'cooking','en'=>'cooking'],
            ['id'=>'cleaning','en'=>'cleaning'],['id'=>'bathing','en'=>'taking a bath or shower'],['id'=>'sleeping','en'=>'sleeping'],
            ['id'=>'studying','en'=>'studying'],['id'=>'working','en'=>'working'],['id'=>'writing','en'=>'writing'],
            ['id'=>'reading','en'=>'reading'],['id'=>'praying-act','en'=>'praying'],['id'=>'fishing','en'=>'fishing'],
            ['id'=>'hunting','en'=>'hunting'],['id'=>'shopping','en'=>'shopping'],['id'=>'traveling','en'=>'traveling'],
            ['id'=>'arguing','en'=>'arguing with someone'],['id'=>'stealing','en'=>'stealing something'],['id'=>'lying','en'=>'lying'],
            ['id'=>'confessing','en'=>'confessing something'],['id'=>'forgiving','en'=>'forgiving someone'],['id'=>'rescuing','en'=>'rescuing someone'],
            ['id'=>'getting-fired','en'=>'getting fired'],['id'=>'winning','en'=>'winning'],['id'=>'losing-something','en'=>'losing something'],
            ['id'=>'gambling','en'=>'gambling'],['id'=>'shaving','en'=>'shaving'],['id'=>'getting-haircut','en'=>'getting a haircut'],
            ['id'=>'packing','en'=>'packing your bags'],['id'=>'falling-in-love','en'=>'falling in love'],
        ],
        'objects' => [
            ['id'=>'money','en'=>'money'],['id'=>'car','en'=>'a car'],['id'=>'key','en'=>'a key'],
            ['id'=>'ring','en'=>'a ring'],['id'=>'knife','en'=>'a knife'],['id'=>'gun','en'=>'a gun'],
            ['id'=>'sword','en'=>'a sword'],['id'=>'mirror','en'=>'a mirror'],['id'=>'door','en'=>'a door'],
            ['id'=>'window','en'=>'a window'],['id'=>'stairs','en'=>'stairs'],['id'=>'bed','en'=>'a bed'],
            ['id'=>'clothes','en'=>'clothes'],['id'=>'shoes','en'=>'shoes'],['id'=>'dress','en'=>'a dress'],
            ['id'=>'hat','en'=>'a hat'],['id'=>'ring-wedding','en'=>'a wedding ring'],['id'=>'clock','en'=>'a clock or watch'],
            ['id'=>'book','en'=>'a book'],['id'=>'letter','en'=>'a letter'],['id'=>'phone','en'=>'a phone'],
            ['id'=>'computer','en'=>'a computer'],['id'=>'television','en'=>'a television'],['id'=>'camera','en'=>'a camera'],
            ['id'=>'food','en'=>'food'],['id'=>'bread','en'=>'bread'],['id'=>'egg','en'=>'eggs'],
            ['id'=>'meat','en'=>'meat'],['id'=>'fruit','en'=>'fruit'],['id'=>'apple','en'=>'an apple'],
            ['id'=>'banana','en'=>'a banana'],['id'=>'cake','en'=>'a cake'],['id'=>'rice','en'=>'rice'],
            ['id'=>'wine','en'=>'wine'],['id'=>'coffee','en'=>'coffee'],['id'=>'milk','en'=>'milk'],
            ['id'=>'gold','en'=>'gold'],['id'=>'silver','en'=>'silver'],['id'=>'diamond','en'=>'a diamond'],
            ['id'=>'jewelry','en'=>'jewelry'],['id'=>'necklace','en'=>'a necklace'],['id'=>'crown','en'=>'a crown'],
            ['id'=>'wallet','en'=>'a wallet'],['id'=>'bag','en'=>'a bag or purse'],['id'=>'suitcase','en'=>'a suitcase'],
            ['id'=>'boat','en'=>'a boat'],['id'=>'ship','en'=>'a ship'],['id'=>'plane','en'=>'an airplane'],
            ['id'=>'train','en'=>'a train'],['id'=>'bus','en'=>'a bus'],['id'=>'bicycle','en'=>'a bicycle'],
            ['id'=>'motorcycle','en'=>'a motorcycle'],['id'=>'candle','en'=>'a candle'],['id'=>'lamp','en'=>'a lamp'],
            ['id'=>'photograph','en'=>'a photograph'],['id'=>'painting','en'=>'a painting'],['id'=>'toilet','en'=>'a toilet'],
            ['id'=>'chair','en'=>'a chair'],['id'=>'table','en'=>'a table'],['id'=>'rope','en'=>'a rope'],
            ['id'=>'chain','en'=>'a chain'],['id'=>'lock','en'=>'a lock'],['id'=>'cage','en'=>'a cage'],
            ['id'=>'umbrella','en'=>'an umbrella'],['id'=>'scissors','en'=>'scissors'],['id'=>'hammer','en'=>'a hammer'],
            ['id'=>'needle','en'=>'a needle'],['id'=>'ball','en'=>'a ball'],['id'=>'doll','en'=>'a doll'],
            ['id'=>'balloon','en'=>'a balloon'],['id'=>'guitar','en'=>'a guitar'],['id'=>'piano','en'=>'a piano'],
            ['id'=>'coin','en'=>'coins'],['id'=>'flag','en'=>'a flag'],['id'=>'gift','en'=>'a gift'],
            ['id'=>'medicine','en'=>'medicine or pills'],['id'=>'glasses','en'=>'glasses'],['id'=>'perfume','en'=>'perfume'],
            ['id'=>'salt','en'=>'salt'],['id'=>'sugar','en'=>'sugar'],['id'=>'chocolate','en'=>'chocolate'],
            ['id'=>'cheese','en'=>'cheese'],['id'=>'onion','en'=>'onions'],['id'=>'garlic','en'=>'garlic'],
            ['id'=>'potato','en'=>'potatoes'],['id'=>'tomato','en'=>'tomatoes'],['id'=>'corn','en'=>'corn'],
            ['id'=>'beans','en'=>'beans'],['id'=>'watermelon','en'=>'a watermelon'],['id'=>'grapes','en'=>'grapes'],
            ['id'=>'orange-fruit','en'=>'an orange'],['id'=>'lemon','en'=>'a lemon'],['id'=>'strawberry','en'=>'strawberries'],
            ['id'=>'pizza','en'=>'pizza'],['id'=>'beer','en'=>'beer'],['id'=>'honey-jar','en'=>'a jar of honey'],
            ['id'=>'broom','en'=>'a broom'],['id'=>'bucket','en'=>'a bucket'],['id'=>'ladder','en'=>'a ladder'],
            ['id'=>'well','en'=>'a well'],['id'=>'fountain','en'=>'a fountain'],['id'=>'bell','en'=>'a bell'],
            ['id'=>'flashlight','en'=>'a flashlight'],['id'=>'matches','en'=>'matches'],['id'=>'map','en'=>'a map'],
            ['id'=>'compass','en'=>'a compass'],['id'=>'telescope','en'=>'a telescope'],['id'=>'coffin','en'=>'a coffin'],
            ['id'=>'tombstone','en'=>'a tombstone'],['id'=>'treasure','en'=>'a treasure'],['id'=>'safe','en'=>'a safe or vault'],
            ['id'=>'bottle','en'=>'a bottle'],['id'=>'cup','en'=>'a cup or glass'],['id'=>'plate','en'=>'a plate of food'],
        ],
        'places' => [
            ['id'=>'house','en'=>'a house'],['id'=>'old-house','en'=>'your childhood home'],['id'=>'school','en'=>'school'],
            ['id'=>'university','en'=>'a university'],['id'=>'hospital','en'=>'a hospital'],['id'=>'church','en'=>'a church'],
            ['id'=>'temple','en'=>'a temple'],['id'=>'cemetery','en'=>'a cemetery'],['id'=>'beach','en'=>'the beach'],
            ['id'=>'forest','en'=>'a forest'],['id'=>'jungle','en'=>'a jungle'],['id'=>'mountain','en'=>'a mountain'],
            ['id'=>'desert','en'=>'a desert'],['id'=>'island','en'=>'an island'],['id'=>'cave','en'=>'a cave'],
            ['id'=>'bridge','en'=>'a bridge'],['id'=>'road','en'=>'a road'],['id'=>'tunnel','en'=>'a tunnel'],
            ['id'=>'prison','en'=>'a prison'],['id'=>'work','en'=>'your workplace'],['id'=>'office','en'=>'an office'],
            ['id'=>'supermarket','en'=>'a supermarket'],['id'=>'market','en'=>'a market'],['id'=>'restaurant','en'=>'a restaurant'],
            ['id'=>'hotel','en'=>'a hotel'],['id'=>'airport','en'=>'an airport'],['id'=>'station','en'=>'a train station'],
            ['id'=>'elevator','en'=>'an elevator'],['id'=>'basement','en'=>'a basement'],['id'=>'attic','en'=>'an attic'],
            ['id'=>'garden','en'=>'a garden'],['id'=>'farm','en'=>'a farm'],['id'=>'zoo','en'=>'a zoo'],
            ['id'=>'park','en'=>'a park'],['id'=>'bathroom','en'=>'a bathroom'],['id'=>'kitchen','en'=>'a kitchen'],
            ['id'=>'bedroom','en'=>'a bedroom'],['id'=>'stadium','en'=>'a stadium'],['id'=>'bank','en'=>'a bank'],
            ['id'=>'library','en'=>'a library'],['id'=>'castle','en'=>'a castle'],['id'=>'ruins','en'=>'ancient ruins'],
            ['id'=>'maze','en'=>'a maze or labyrinth'],['id'=>'swimming-pool','en'=>'a swimming pool'],['id'=>'waterfall','en'=>'a waterfall'],
            ['id'=>'lake','en'=>'a lake'],['id'=>'cliff','en'=>'a cliff'],['id'=>'crossroads','en'=>'a crossroads'],
            ['id'=>'pharmacy','en'=>'a pharmacy'],['id'=>'gas-station','en'=>'a gas station'],['id'=>'mall','en'=>'a shopping mall'],
            ['id'=>'theater','en'=>'a theater or cinema'],['id'=>'gym','en'=>'a gym'],['id'=>'courtroom','en'=>'a courtroom'],
            ['id'=>'police-station','en'=>'a police station'],['id'=>'mosque','en'=>'a mosque'],['id'=>'swamp','en'=>'a swamp'],
            ['id'=>'valley','en'=>'a valley'],['id'=>'field','en'=>'an open field'],['id'=>'harbor','en'=>'a harbor or port'],
            ['id'=>'rooftop','en'=>'a rooftop'],['id'=>'staircase-place','en'=>'a long staircase'],['id'=>'abandoned-house','en'=>'an abandoned house'],
        ],
        'feelings' => [
            ['id'=>'fear','en'=>'feeling intense fear'],['id'=>'happiness','en'=>'feeling happy'],['id'=>'sadness','en'=>'feeling deep sadness'],
            ['id'=>'anger','en'=>'feeling anger'],['id'=>'love','en'=>'feeling love'],['id'=>'anxiety','en'=>'feeling anxiety'],
            ['id'=>'guilt','en'=>'feeling guilt'],['id'=>'jealousy','en'=>'feeling jealousy'],['id'=>'loneliness','en'=>'feeling lonely'],
            ['id'=>'shame','en'=>'feeling shame'],['id'=>'peace','en'=>'feeling peace'],['id'=>'confusion','en'=>'feeling confused'],
            ['id'=>'embarrassment','en'=>'feeling embarrassed'],['id'=>'relief','en'=>'feeling relief'],['id'=>'panic','en'=>'feeling panic'],
            ['id'=>'nostalgia','en'=>'feeling nostalgia'],['id'=>'helplessness','en'=>'feeling helpless'],['id'=>'excitement','en'=>'feeling excited'],
            ['id'=>'disgust','en'=>'feeling disgust'],['id'=>'gratitude','en'=>'feeling gratitude'],
        ],
        'events' => [
            ['id'=>'wedding','en'=>'a wedding'],['id'=>'death','en'=>'death'],['id'=>'birth','en'=>'a birth'],
            ['id'=>'funeral','en'=>'a funeral'],['id'=>'accident','en'=>'an accident'],['id'=>'car-crash','en'=>'a car crash'],
            ['id'=>'war','en'=>'war'],['id'=>'party','en'=>'a party'],['id'=>'birthday','en'=>'a birthday'],
            ['id'=>'exam','en'=>'an exam or test'],['id'=>'pregnancy','en'=>'pregnancy'],['id'=>'graduation','en'=>'a graduation'],
            ['id'=>'divorce','en'=>'a divorce'],['id'=>'moving-house','en'=>'moving to a new house'],['id'=>'flood','en'=>'a flood'],
            ['id'=>'earthquake','en'=>'an earthquake'],['id'=>'fire-event','en'=>'a building on fire'],['id'=>'robbery','en'=>'a robbery'],
            ['id'=>'betrayal','en'=>'betrayal'],['id'=>'job-interview','en'=>'a job interview'],['id'=>'breakup','en'=>'a breakup'],
            ['id'=>'reunion','en'=>'a family reunion'],['id'=>'kidnapping','en'=>'a kidnapping'],['id'=>'explosion','en'=>'an explosion'],
            ['id'=>'storm-event','en'=>'a violent storm'],['id'=>'apocalypse','en'=>'the end of the world'],['id'=>'eclipse','en'=>'an eclipse'],
            ['id'=>'shipwreck','en'=>'a shipwreck'],['id'=>'plane-crash','en'=>'a plane crash'],['id'=>'concert','en'=>'a concert'],
            ['id'=>'protest','en'=>'a protest'],['id'=>'election','en'=>'an election'],['id'=>'lottery','en'=>'winning the lottery'],
            ['id'=>'surgery','en'=>'a surgery'],['id'=>'engagement','en'=>'an engagement'],['id'=>'baptism','en'=>'a baptism'],
            ['id'=>'tsunami','en'=>'a tsunami'],['id'=>'tornado','en'=>'a tornado'],['id'=>'volcano-eruption','en'=>'a volcano erupting'],
            ['id'=>'falling-tooth-event','en'=>'a tooth falling out'],['id'=>'getting-arrested','en'=>'getting arrested'],
            ['id'=>'losing-job','en'=>'losing your job'],['id'=>'new-job','en'=>'starting a new job'],['id'=>'miscarriage','en'=>'a miscarriage'],
        ],
        'body' => [
            ['id'=>'tooth-falling','en'=>'teeth falling out'],['id'=>'teeth','en'=>'teeth'],['id'=>'hair','en'=>'hair'],
            ['id'=>'hair-falling','en'=>'hair falling out'],['id'=>'blood','en'=>'blood'],['id'=>'eyes','en'=>'eyes'],
            ['id'=>'hands','en'=>'hands'],['id'=>'feet','en'=>'feet'],['id'=>'legs','en'=>'legs'],
            ['id'=>'arms','en'=>'arms'],['id'=>'nails','en'=>'fingernails'],['id'=>'face','en'=>'a face'],
            ['id'=>'nose','en'=>'the nose'],['id'=>'mouth','en'=>'the mouth'],['id'=>'tongue','en'=>'the tongue'],
            ['id'=>'ears','en'=>'ears'],['id'=>'heart','en'=>'the heart'],['id'=>'skin','en'=>'the skin'],
            ['id'=>'bones','en'=>'bones'],['id'=>'broken-bone','en'=>'a broken bone'],['id'=>'wound','en'=>'a wound'],
            ['id'=>'scar','en'=>'a scar'],['id'=>'belly','en'=>'the belly'],['id'=>'pregnant-belly','en'=>'being pregnant (a pregnant belly)'],
            ['id'=>'vomiting','en'=>'vomiting'],['id'=>'bleeding','en'=>'bleeding'],['id'=>'sweating','en'=>'sweating'],
            ['id'=>'crying-blood','en'=>'crying'],['id'=>'naked-body','en'=>'being naked'],['id'=>'pain','en'=>'feeling pain'],
            ['id'=>'illness','en'=>'being sick'],['id'=>'fever','en'=>'having a fever'],['id'=>'scars-burns','en'=>'a burn'],
            ['id'=>'amputation','en'=>'losing a limb'],['id'=>'beard','en'=>'a beard'],
        ],
        'nature' => [
            ['id'=>'water','en'=>'water'],['id'=>'clear-water','en'=>'clear water'],['id'=>'dirty-water','en'=>'dirty or muddy water'],
            ['id'=>'fire','en'=>'fire'],['id'=>'rain','en'=>'rain'],['id'=>'storm','en'=>'a storm'],
            ['id'=>'lightning','en'=>'lightning'],['id'=>'thunder','en'=>'thunder'],['id'=>'snow','en'=>'snow'],
            ['id'=>'ice','en'=>'ice'],['id'=>'wind','en'=>'wind'],['id'=>'fog','en'=>'fog'],
            ['id'=>'sea','en'=>'the sea'],['id'=>'river','en'=>'a river'],['id'=>'ocean-waves','en'=>'ocean waves'],
            ['id'=>'sun','en'=>'the sun'],['id'=>'moon','en'=>'the moon'],['id'=>'stars','en'=>'stars'],
            ['id'=>'sky','en'=>'the sky'],['id'=>'rainbow','en'=>'a rainbow'],['id'=>'clouds','en'=>'clouds'],
            ['id'=>'tree','en'=>'a tree'],['id'=>'forest-nature','en'=>'green woods'],['id'=>'flowers','en'=>'flowers'],
            ['id'=>'rose','en'=>'roses'],['id'=>'grass','en'=>'grass'],['id'=>'leaves','en'=>'leaves'],
            ['id'=>'mountain-nature','en'=>'a mountain peak'],['id'=>'volcano','en'=>'a volcano'],['id'=>'earth','en'=>'the earth or soil'],
            ['id'=>'mud','en'=>'mud'],['id'=>'sand','en'=>'sand'],['id'=>'stone','en'=>'stones or rocks'],
            ['id'=>'gold-nugget','en'=>'a gold nugget'],['id'=>'fruit-tree','en'=>'a fruit tree'],['id'=>'seeds','en'=>'seeds'],
            ['id'=>'honey','en'=>'honey'],['id'=>'forest-fire','en'=>'a wildfire'],['id'=>'flood-water','en'=>'rising water'],
            ['id'=>'hail','en'=>'hail'],['id'=>'dawn','en'=>'the sunrise'],['id'=>'sunset','en'=>'the sunset'],
            ['id'=>'night','en'=>'a dark night'],['id'=>'meteor','en'=>'a falling star or meteor'],['id'=>'comet','en'=>'a comet'],
            ['id'=>'whirlpool','en'=>'a whirlpool'],['id'=>'tide','en'=>'the tide'],['id'=>'dew','en'=>'morning dew'],
            ['id'=>'frost','en'=>'frost'],['id'=>'cave-water','en'=>'an underground spring'],['id'=>'mushroom','en'=>'mushrooms'],
            ['id'=>'cactus','en'=>'a cactus'],['id'=>'vine','en'=>'climbing vines'],['id'=>'thorns','en'=>'thorns'],
            ['id'=>'palm-tree','en'=>'a palm tree'],['id'=>'autumn-leaves','en'=>'falling autumn leaves'],['id'=>'fog-mist','en'=>'thick mist'],
        ],
        'spiritual' => [
            ['id'=>'god','en'=>'God'],['id'=>'angel','en'=>'an angel'],['id'=>'devil','en'=>'the devil'],
            ['id'=>'demon','en'=>'a demon'],['id'=>'ghost','en'=>'a ghost'],['id'=>'spirit','en'=>'a spirit'],
            ['id'=>'soul','en'=>'a soul'],['id'=>'praying','en'=>'praying'],['id'=>'heaven','en'=>'heaven'],
            ['id'=>'hell','en'=>'hell'],['id'=>'light','en'=>'a bright light'],['id'=>'darkness','en'=>'darkness'],
            ['id'=>'witch','en'=>'a witch'],['id'=>'cross','en'=>'a cross'],['id'=>'bible','en'=>'a bible or holy book'],
            ['id'=>'jesus','en'=>'Jesus'],['id'=>'virgin-mary','en'=>'the Virgin Mary'],['id'=>'saint','en'=>'a saint'],
            ['id'=>'prophet','en'=>'a prophet'],['id'=>'miracle','en'=>'a miracle'],['id'=>'resurrection','en'=>'someone coming back from the dead'],
            ['id'=>'reincarnation','en'=>'reincarnation'],['id'=>'aura','en'=>'an aura or energy'],['id'=>'meditation','en'=>'meditating'],
            ['id'=>'candle-ritual','en'=>'lighting a candle in a ritual'],['id'=>'tarot','en'=>'tarot cards'],['id'=>'crystal-ball','en'=>'a crystal ball'],
            ['id'=>'amulet','en'=>'an amulet or talisman'],['id'=>'curse','en'=>'a curse'],['id'=>'blessing','en'=>'a blessing'],
            ['id'=>'altar','en'=>'an altar'],['id'=>'mermaid','en'=>'a mermaid'],['id'=>'fairy','en'=>'a fairy'],
            ['id'=>'monster','en'=>'a monster'],['id'=>'zombie','en'=>'a zombie'],['id'=>'vampire','en'=>'a vampire'],
            ['id'=>'werewolf','en'=>'a werewolf'],['id'=>'shadow-figure','en'=>'a shadowy figure'],['id'=>'third-eye','en'=>'opening the third eye'],
        ],
    ];

    /** @return string[] */
    public static function categories(): array
    {
        return array_keys(self::DATA);
    }

    /** Itens agrupados por categoria. */
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
