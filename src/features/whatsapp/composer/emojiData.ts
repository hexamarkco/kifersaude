import type { EmojiCategoryId, EmojiEntry } from './types';

export type EmojiCategoryData = {
  id: Exclude<EmojiCategoryId, 'recent'>;
  label: string;
  nativeLabel: string;
  emojis: EmojiEntry[];
};

export const EMOJI_CATEGORIES_DATA: EmojiCategoryData[] = [
  {
    "id": "smileys",
    "label": "Rostos",
    "nativeLabel": "Smileys e emocoes",
    "emojis": [
      {
        "value": "😀",
        "keywords": [
          "grinning",
          "grinning face",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😃",
        "keywords": [
          "smiley",
          "smiling face with open mouth",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😄",
        "keywords": [
          "smile",
          "smiling face with open mouth and smiling eyes",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😁",
        "keywords": [
          "grin",
          "grinning face with smiling eyes",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😆",
        "keywords": [
          "laughing",
          "satisfied",
          "smiling face with open mouth and tightly-closed eyes",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😅",
        "keywords": [
          "sweat smile",
          "sweat",
          "smile",
          "smiling face with open mouth and cold sweat",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "🤣",
        "keywords": [
          "rolling on the floor laughing",
          "rolling",
          "on",
          "the",
          "floor",
          "laughing",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😂",
        "keywords": [
          "joy",
          "face with tears of joy",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "🙂",
        "keywords": [
          "slightly smiling face",
          "slightly",
          "smiling",
          "face",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "🙃",
        "keywords": [
          "upside down face",
          "upside",
          "down",
          "face",
          "upside-down face",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "🫠",
        "keywords": [
          "melting face",
          "melting",
          "face",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😉",
        "keywords": [
          "wink",
          "winking face",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😊",
        "keywords": [
          "blush",
          "smiling face with smiling eyes",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "😇",
        "keywords": [
          "innocent",
          "smiling face with halo",
          "smileys emotion",
          "face-smiling"
        ]
      },
      {
        "value": "🥰",
        "keywords": [
          "smiling face with 3 hearts",
          "smiling",
          "face",
          "with",
          "3",
          "hearts",
          "smiling face with smiling eyes and three hearts",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "😍",
        "keywords": [
          "heart eyes",
          "heart",
          "eyes",
          "smiling face with heart-shaped eyes",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "🤩",
        "keywords": [
          "star-struck",
          "grinning face with star eyes",
          "grinning",
          "face",
          "with",
          "star",
          "eyes",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "😘",
        "keywords": [
          "kissing heart",
          "kissing",
          "heart",
          "face throwing a kiss",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "😗",
        "keywords": [
          "kissing",
          "kissing face",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "☺️",
        "keywords": [
          "relaxed",
          "white smiling face",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "😚",
        "keywords": [
          "kissing closed eyes",
          "kissing",
          "closed",
          "eyes",
          "kissing face with closed eyes",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "😙",
        "keywords": [
          "kissing smiling eyes",
          "kissing",
          "smiling",
          "eyes",
          "kissing face with smiling eyes",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "🥲",
        "keywords": [
          "smiling face with tear",
          "smiling",
          "face",
          "with",
          "tear",
          "smileys emotion",
          "face-affection"
        ]
      },
      {
        "value": "😋",
        "keywords": [
          "yum",
          "face savouring delicious food",
          "smileys emotion",
          "face-tongue"
        ]
      },
      {
        "value": "😛",
        "keywords": [
          "stuck out tongue",
          "stuck",
          "out",
          "tongue",
          "face with stuck-out tongue",
          "smileys emotion",
          "face-tongue"
        ]
      },
      {
        "value": "😜",
        "keywords": [
          "stuck out tongue winking eye",
          "stuck",
          "out",
          "tongue",
          "winking",
          "eye",
          "face with stuck-out tongue and winking eye",
          "smileys emotion",
          "face-tongue"
        ]
      },
      {
        "value": "🤪",
        "keywords": [
          "zany face",
          "zany",
          "face",
          "grinning face with one large and one small eye",
          "grinning",
          "with",
          "one",
          "large",
          "and",
          "small",
          "eye",
          "smileys emotion",
          "face-tongue"
        ]
      },
      {
        "value": "😝",
        "keywords": [
          "stuck out tongue closed eyes",
          "stuck",
          "out",
          "tongue",
          "closed",
          "eyes",
          "face with stuck-out tongue and tightly-closed eyes",
          "smileys emotion",
          "face-tongue"
        ]
      },
      {
        "value": "🤑",
        "keywords": [
          "money mouth face",
          "money",
          "mouth",
          "face",
          "money-mouth face",
          "smileys emotion",
          "face-tongue"
        ]
      },
      {
        "value": "🤗",
        "keywords": [
          "hugging face",
          "hugging",
          "face",
          "smileys emotion",
          "face-hand"
        ]
      },
      {
        "value": "🤭",
        "keywords": [
          "face with hand over mouth",
          "face",
          "with",
          "hand",
          "over",
          "mouth",
          "smiling face with smiling eyes and hand covering mouth",
          "smiling",
          "eyes",
          "and",
          "covering",
          "smileys emotion",
          "face-hand"
        ]
      },
      {
        "value": "🫢",
        "keywords": [
          "face with open eyes and hand over mouth",
          "face",
          "with",
          "open",
          "eyes",
          "and",
          "hand",
          "over",
          "mouth",
          "smileys emotion",
          "face-hand"
        ]
      },
      {
        "value": "🫣",
        "keywords": [
          "face with peeking eye",
          "face",
          "with",
          "peeking",
          "eye",
          "smileys emotion",
          "face-hand"
        ]
      },
      {
        "value": "🤫",
        "keywords": [
          "shushing face",
          "shushing",
          "face",
          "face with finger covering closed lips",
          "with",
          "finger",
          "covering",
          "closed",
          "lips",
          "smileys emotion",
          "face-hand"
        ]
      },
      {
        "value": "🤔",
        "keywords": [
          "thinking face",
          "thinking",
          "face",
          "smileys emotion",
          "face-hand"
        ]
      },
      {
        "value": "🫡",
        "keywords": [
          "saluting face",
          "saluting",
          "face",
          "smileys emotion",
          "face-hand"
        ]
      },
      {
        "value": "🤐",
        "keywords": [
          "zipper mouth face",
          "zipper",
          "mouth",
          "face",
          "zipper-mouth face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "🤨",
        "keywords": [
          "face with raised eyebrow",
          "face",
          "with",
          "raised",
          "eyebrow",
          "face with one eyebrow raised",
          "one",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😐",
        "keywords": [
          "neutral face",
          "neutral",
          "face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😑",
        "keywords": [
          "expressionless",
          "expressionless face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😶",
        "keywords": [
          "no mouth",
          "no",
          "mouth",
          "face without mouth",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "🫥",
        "keywords": [
          "dotted line face",
          "dotted",
          "line",
          "face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😶‍🌫️",
        "keywords": [
          "face in clouds",
          "face",
          "in",
          "clouds",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😏",
        "keywords": [
          "smirk",
          "smirking face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😒",
        "keywords": [
          "unamused",
          "unamused face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "🙄",
        "keywords": [
          "face with rolling eyes",
          "face",
          "with",
          "rolling",
          "eyes",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😬",
        "keywords": [
          "grimacing",
          "grimacing face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😮‍💨",
        "keywords": [
          "face exhaling",
          "face",
          "exhaling",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "🤥",
        "keywords": [
          "lying face",
          "lying",
          "face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "🫨",
        "keywords": [
          "shaking face",
          "shaking",
          "face",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "🙂‍↔️",
        "keywords": [
          "head shaking horizontally",
          "head",
          "shaking",
          "horizontally",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "🙂‍↕️",
        "keywords": [
          "head shaking vertically",
          "head",
          "shaking",
          "vertically",
          "smileys emotion",
          "face-neutral-skeptical"
        ]
      },
      {
        "value": "😌",
        "keywords": [
          "relieved",
          "relieved face",
          "smileys emotion",
          "face-sleepy"
        ]
      },
      {
        "value": "😔",
        "keywords": [
          "pensive",
          "pensive face",
          "smileys emotion",
          "face-sleepy"
        ]
      },
      {
        "value": "😪",
        "keywords": [
          "sleepy",
          "sleepy face",
          "smileys emotion",
          "face-sleepy"
        ]
      },
      {
        "value": "🤤",
        "keywords": [
          "drooling face",
          "drooling",
          "face",
          "smileys emotion",
          "face-sleepy"
        ]
      },
      {
        "value": "😴",
        "keywords": [
          "sleeping",
          "sleeping face",
          "smileys emotion",
          "face-sleepy"
        ]
      },
      {
        "value": "🫩",
        "keywords": [
          "face with bags under eyes",
          "face",
          "with",
          "bags",
          "under",
          "eyes",
          "smileys emotion",
          "face-sleepy"
        ]
      },
      {
        "value": "😷",
        "keywords": [
          "mask",
          "face with medical mask",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🤒",
        "keywords": [
          "face with thermometer",
          "face",
          "with",
          "thermometer",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🤕",
        "keywords": [
          "face with head bandage",
          "face",
          "with",
          "head",
          "bandage",
          "face with head-bandage",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🤢",
        "keywords": [
          "nauseated face",
          "nauseated",
          "face",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🤮",
        "keywords": [
          "face vomiting",
          "face",
          "vomiting",
          "face with open mouth vomiting",
          "with",
          "open",
          "mouth",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🤧",
        "keywords": [
          "sneezing face",
          "sneezing",
          "face",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🥵",
        "keywords": [
          "hot face",
          "hot",
          "face",
          "overheated face",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🥶",
        "keywords": [
          "cold face",
          "cold",
          "face",
          "freezing face",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🥴",
        "keywords": [
          "woozy face",
          "woozy",
          "face",
          "face with uneven eyes and wavy mouth",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "😵",
        "keywords": [
          "dizzy face",
          "dizzy",
          "face",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "😵‍💫",
        "keywords": [
          "face with spiral eyes",
          "face",
          "with",
          "spiral",
          "eyes",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🤯",
        "keywords": [
          "exploding head",
          "exploding",
          "head",
          "shocked face with exploding head",
          "shocked",
          "face",
          "with",
          "smileys emotion",
          "face-unwell"
        ]
      },
      {
        "value": "🤠",
        "keywords": [
          "face with cowboy hat",
          "face",
          "with",
          "cowboy",
          "hat",
          "smileys emotion",
          "face-hat"
        ]
      },
      {
        "value": "🥳",
        "keywords": [
          "partying face",
          "partying",
          "face",
          "face with party horn and party hat",
          "smileys emotion",
          "face-hat"
        ]
      },
      {
        "value": "🥸",
        "keywords": [
          "disguised face",
          "disguised",
          "face",
          "smileys emotion",
          "face-hat"
        ]
      },
      {
        "value": "😎",
        "keywords": [
          "sunglasses",
          "smiling face with sunglasses",
          "smileys emotion",
          "face-glasses"
        ]
      },
      {
        "value": "🤓",
        "keywords": [
          "nerd face",
          "nerd",
          "face",
          "smileys emotion",
          "face-glasses"
        ]
      },
      {
        "value": "🧐",
        "keywords": [
          "face with monocle",
          "face",
          "with",
          "monocle",
          "smileys emotion",
          "face-glasses"
        ]
      },
      {
        "value": "😕",
        "keywords": [
          "confused",
          "confused face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "🫤",
        "keywords": [
          "face with diagonal mouth",
          "face",
          "with",
          "diagonal",
          "mouth",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😟",
        "keywords": [
          "worried",
          "worried face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "🙁",
        "keywords": [
          "slightly frowning face",
          "slightly",
          "frowning",
          "face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "☹️",
        "keywords": [
          "white frowning face",
          "white",
          "frowning",
          "face",
          "frowning face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😮",
        "keywords": [
          "open mouth",
          "open",
          "mouth",
          "face with open mouth",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😯",
        "keywords": [
          "hushed",
          "hushed face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😲",
        "keywords": [
          "astonished",
          "astonished face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😳",
        "keywords": [
          "flushed",
          "flushed face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "🥺",
        "keywords": [
          "pleading face",
          "pleading",
          "face",
          "face with pleading eyes",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "🥹",
        "keywords": [
          "face holding back tears",
          "face",
          "holding",
          "back",
          "tears",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😦",
        "keywords": [
          "frowning",
          "frowning face with open mouth",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😧",
        "keywords": [
          "anguished",
          "anguished face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😨",
        "keywords": [
          "fearful",
          "fearful face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😰",
        "keywords": [
          "cold sweat",
          "cold",
          "sweat",
          "face with open mouth and cold sweat",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😥",
        "keywords": [
          "disappointed relieved",
          "disappointed",
          "relieved",
          "disappointed but relieved face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😢",
        "keywords": [
          "cry",
          "crying face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😭",
        "keywords": [
          "sob",
          "loudly crying face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😱",
        "keywords": [
          "scream",
          "face screaming in fear",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😖",
        "keywords": [
          "confounded",
          "confounded face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😣",
        "keywords": [
          "persevere",
          "persevering face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😞",
        "keywords": [
          "disappointed",
          "disappointed face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😓",
        "keywords": [
          "sweat",
          "face with cold sweat",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😩",
        "keywords": [
          "weary",
          "weary face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😫",
        "keywords": [
          "tired face",
          "tired",
          "face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "🥱",
        "keywords": [
          "yawning face",
          "yawning",
          "face",
          "smileys emotion",
          "face-concerned"
        ]
      },
      {
        "value": "😤",
        "keywords": [
          "triumph",
          "face with look of triumph",
          "smileys emotion",
          "face-negative"
        ]
      },
      {
        "value": "😡",
        "keywords": [
          "rage",
          "pouting face",
          "smileys emotion",
          "face-negative"
        ]
      },
      {
        "value": "😠",
        "keywords": [
          "angry",
          "angry face",
          "smileys emotion",
          "face-negative"
        ]
      },
      {
        "value": "🤬",
        "keywords": [
          "face with symbols on mouth",
          "face",
          "with",
          "symbols",
          "on",
          "mouth",
          "serious face with symbols covering mouth",
          "serious",
          "covering",
          "smileys emotion",
          "face-negative"
        ]
      },
      {
        "value": "😈",
        "keywords": [
          "smiling imp",
          "smiling",
          "imp",
          "smiling face with horns",
          "smileys emotion",
          "face-negative"
        ]
      },
      {
        "value": "👿",
        "keywords": [
          "imp",
          "smileys emotion",
          "face-negative"
        ]
      },
      {
        "value": "💀",
        "keywords": [
          "skull",
          "smileys emotion",
          "face-negative"
        ]
      },
      {
        "value": "☠️",
        "keywords": [
          "skull and crossbones",
          "skull",
          "and",
          "crossbones",
          "smileys emotion",
          "face-negative"
        ]
      },
      {
        "value": "💩",
        "keywords": [
          "hankey",
          "poop",
          "shit",
          "pile of poo",
          "smileys emotion",
          "face-costume"
        ]
      },
      {
        "value": "🤡",
        "keywords": [
          "clown face",
          "clown",
          "face",
          "smileys emotion",
          "face-costume"
        ]
      },
      {
        "value": "👹",
        "keywords": [
          "japanese ogre",
          "japanese",
          "ogre",
          "smileys emotion",
          "face-costume"
        ]
      },
      {
        "value": "👺",
        "keywords": [
          "japanese goblin",
          "japanese",
          "goblin",
          "smileys emotion",
          "face-costume"
        ]
      },
      {
        "value": "👻",
        "keywords": [
          "ghost",
          "smileys emotion",
          "face-costume"
        ]
      },
      {
        "value": "👽",
        "keywords": [
          "alien",
          "extraterrestrial alien",
          "smileys emotion",
          "face-costume"
        ]
      },
      {
        "value": "👾",
        "keywords": [
          "space invader",
          "space",
          "invader",
          "alien monster",
          "smileys emotion",
          "face-costume"
        ]
      },
      {
        "value": "🤖",
        "keywords": [
          "robot face",
          "robot",
          "face",
          "smileys emotion",
          "face-costume"
        ]
      },
      {
        "value": "😺",
        "keywords": [
          "smiley cat",
          "smiley",
          "cat",
          "smiling cat face with open mouth",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "😸",
        "keywords": [
          "smile cat",
          "smile",
          "cat",
          "grinning cat face with smiling eyes",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "😹",
        "keywords": [
          "joy cat",
          "joy",
          "cat",
          "cat face with tears of joy",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "😻",
        "keywords": [
          "heart eyes cat",
          "heart",
          "eyes",
          "cat",
          "smiling cat face with heart-shaped eyes",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "😼",
        "keywords": [
          "smirk cat",
          "smirk",
          "cat",
          "cat face with wry smile",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "😽",
        "keywords": [
          "kissing cat",
          "kissing",
          "cat",
          "kissing cat face with closed eyes",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "🙀",
        "keywords": [
          "scream cat",
          "scream",
          "cat",
          "weary cat face",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "😿",
        "keywords": [
          "crying cat face",
          "crying",
          "cat",
          "face",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "😾",
        "keywords": [
          "pouting cat",
          "pouting",
          "cat",
          "pouting cat face",
          "smileys emotion",
          "cat-face"
        ]
      },
      {
        "value": "🙈",
        "keywords": [
          "see no evil",
          "see",
          "no",
          "evil",
          "see-no-evil monkey",
          "smileys emotion",
          "monkey-face"
        ]
      },
      {
        "value": "🙉",
        "keywords": [
          "hear no evil",
          "hear",
          "no",
          "evil",
          "hear-no-evil monkey",
          "smileys emotion",
          "monkey-face"
        ]
      },
      {
        "value": "🙊",
        "keywords": [
          "speak no evil",
          "speak",
          "no",
          "evil",
          "speak-no-evil monkey",
          "smileys emotion",
          "monkey-face"
        ]
      },
      {
        "value": "💌",
        "keywords": [
          "love letter",
          "love",
          "letter",
          "smileys emotion",
          "heart"
        ]
      },
      {
        "value": "💘",
        "keywords": [
          "cupid",
          "heart with arrow",
          "smileys emotion",
          "heart"
        ]
      },
      {
        "value": "💝",
        "keywords": [
          "gift heart",
          "gift",
          "heart",
          "heart with ribbon",
          "smileys emotion"
        ]
      },
      {
        "value": "💖",
        "keywords": [
          "sparkling heart",
          "sparkling",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "💗",
        "keywords": [
          "heartpulse",
          "growing heart",
          "smileys emotion",
          "heart"
        ]
      },
      {
        "value": "💓",
        "keywords": [
          "heartbeat",
          "beating heart",
          "smileys emotion",
          "heart"
        ]
      },
      {
        "value": "💞",
        "keywords": [
          "revolving hearts",
          "revolving",
          "hearts",
          "smileys emotion",
          "heart"
        ]
      },
      {
        "value": "💕",
        "keywords": [
          "two hearts",
          "two",
          "hearts",
          "smileys emotion",
          "heart"
        ]
      },
      {
        "value": "💟",
        "keywords": [
          "heart decoration",
          "heart",
          "decoration",
          "smileys emotion"
        ]
      },
      {
        "value": "❣️",
        "keywords": [
          "heavy heart exclamation mark ornament",
          "heavy",
          "heart",
          "exclamation",
          "mark",
          "ornament",
          "heart exclamation",
          "smileys emotion"
        ]
      },
      {
        "value": "💔",
        "keywords": [
          "broken heart",
          "broken",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "❤️‍🔥",
        "keywords": [
          "heart on fire",
          "heart",
          "on",
          "fire",
          "smileys emotion"
        ]
      },
      {
        "value": "❤️‍🩹",
        "keywords": [
          "mending heart",
          "mending",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "❤️",
        "keywords": [
          "heart",
          "heavy black heart",
          "smileys emotion"
        ]
      },
      {
        "value": "🩷",
        "keywords": [
          "pink heart",
          "pink",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "🧡",
        "keywords": [
          "orange heart",
          "orange",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "💛",
        "keywords": [
          "yellow heart",
          "yellow",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "💚",
        "keywords": [
          "green heart",
          "green",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "💙",
        "keywords": [
          "blue heart",
          "blue",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "🩵",
        "keywords": [
          "light blue heart",
          "light",
          "blue",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "💜",
        "keywords": [
          "purple heart",
          "purple",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "🤎",
        "keywords": [
          "brown heart",
          "brown",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "🖤",
        "keywords": [
          "black heart",
          "black",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "🩶",
        "keywords": [
          "grey heart",
          "grey",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "🤍",
        "keywords": [
          "white heart",
          "white",
          "heart",
          "smileys emotion"
        ]
      },
      {
        "value": "💋",
        "keywords": [
          "kiss",
          "kiss mark",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💯",
        "keywords": [
          "100",
          "hundred points symbol",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💢",
        "keywords": [
          "anger",
          "anger symbol",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💥",
        "keywords": [
          "boom",
          "collision",
          "collision symbol",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💫",
        "keywords": [
          "dizzy",
          "dizzy symbol",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💦",
        "keywords": [
          "sweat drops",
          "sweat",
          "drops",
          "splashing sweat symbol",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💨",
        "keywords": [
          "dash",
          "dash symbol",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "🕳️",
        "keywords": [
          "hole",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💬",
        "keywords": [
          "speech balloon",
          "speech",
          "balloon",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "👁️‍🗨️",
        "keywords": [
          "eye-in-speech-bubble",
          "eye in speech bubble",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "🗨️",
        "keywords": [
          "left speech bubble",
          "left",
          "speech",
          "bubble",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "🗯️",
        "keywords": [
          "right anger bubble",
          "right",
          "anger",
          "bubble",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💭",
        "keywords": [
          "thought balloon",
          "thought",
          "balloon",
          "smileys emotion",
          "emotion"
        ]
      },
      {
        "value": "💤",
        "keywords": [
          "zzz",
          "sleeping symbol",
          "smileys emotion",
          "emotion"
        ]
      }
    ]
  },
  {
    "id": "people",
    "label": "Pessoas",
    "nativeLabel": "Pessoas e corpo",
    "emojis": [
      {
        "value": "👋",
        "keywords": [
          "wave",
          "waving hand sign",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🤚",
        "keywords": [
          "raised back of hand",
          "raised",
          "back",
          "of",
          "hand",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🖐️",
        "keywords": [
          "raised hand with fingers splayed",
          "raised",
          "hand",
          "with",
          "fingers",
          "splayed",
          "hand with fingers splayed",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "✋",
        "keywords": [
          "hand",
          "raised hand",
          "raised",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🖖",
        "keywords": [
          "spock-hand",
          "raised hand with part between middle and ring fingers",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🫱",
        "keywords": [
          "rightwards hand",
          "rightwards",
          "hand",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🫲",
        "keywords": [
          "leftwards hand",
          "leftwards",
          "hand",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🫳",
        "keywords": [
          "palm down hand",
          "palm",
          "down",
          "hand",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🫴",
        "keywords": [
          "palm up hand",
          "palm",
          "up",
          "hand",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🫷",
        "keywords": [
          "leftwards pushing hand",
          "leftwards",
          "pushing",
          "hand",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "🫸",
        "keywords": [
          "rightwards pushing hand",
          "rightwards",
          "pushing",
          "hand",
          "people body",
          "hand-fingers-open"
        ]
      },
      {
        "value": "👌",
        "keywords": [
          "ok hand",
          "ok",
          "hand",
          "ok hand sign",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "🤌",
        "keywords": [
          "pinched fingers",
          "pinched",
          "fingers",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "🤏",
        "keywords": [
          "pinching hand",
          "pinching",
          "hand",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "✌️",
        "keywords": [
          "v",
          "victory hand",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "🤞",
        "keywords": [
          "crossed fingers",
          "crossed",
          "fingers",
          "hand with index and middle fingers crossed",
          "hand",
          "with",
          "index",
          "and",
          "middle",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "🫰",
        "keywords": [
          "hand with index finger and thumb crossed",
          "hand",
          "with",
          "index",
          "finger",
          "and",
          "thumb",
          "crossed",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "🤟",
        "keywords": [
          "i love you hand sign",
          "i",
          "love",
          "you",
          "hand",
          "sign",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "🤘",
        "keywords": [
          "the horns",
          "the",
          "horns",
          "sign of the horns",
          "sign",
          "of",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "🤙",
        "keywords": [
          "call me hand",
          "call",
          "me",
          "hand",
          "people body",
          "hand-fingers-partial"
        ]
      },
      {
        "value": "👈",
        "keywords": [
          "point left",
          "point",
          "left",
          "white left pointing backhand index",
          "people body",
          "hand-single-finger"
        ]
      },
      {
        "value": "👉",
        "keywords": [
          "point right",
          "point",
          "right",
          "white right pointing backhand index",
          "people body",
          "hand-single-finger"
        ]
      },
      {
        "value": "👆",
        "keywords": [
          "point up 2",
          "point",
          "up",
          "2",
          "white up pointing backhand index",
          "people body",
          "hand-single-finger"
        ]
      },
      {
        "value": "🖕",
        "keywords": [
          "middle finger",
          "middle",
          "finger",
          "reversed hand with middle finger extended",
          "reversed",
          "hand",
          "with",
          "extended",
          "people body",
          "hand-single-finger"
        ]
      },
      {
        "value": "👇",
        "keywords": [
          "point down",
          "point",
          "down",
          "white down pointing backhand index",
          "people body",
          "hand-single-finger"
        ]
      },
      {
        "value": "☝️",
        "keywords": [
          "point up",
          "point",
          "up",
          "white up pointing index",
          "people body",
          "hand-single-finger"
        ]
      },
      {
        "value": "🫵",
        "keywords": [
          "index pointing at the viewer",
          "index",
          "pointing",
          "at",
          "the",
          "viewer",
          "people body",
          "hand-single-finger"
        ]
      },
      {
        "value": "👍",
        "keywords": [
          "+1",
          "thumbsup",
          "thumbs up sign",
          "people body",
          "hand-fingers-closed"
        ]
      },
      {
        "value": "👎",
        "keywords": [
          "-1",
          "thumbsdown",
          "thumbs down sign",
          "people body",
          "hand-fingers-closed"
        ]
      },
      {
        "value": "✊",
        "keywords": [
          "fist",
          "raised fist",
          "people body",
          "hand-fingers-closed"
        ]
      },
      {
        "value": "👊",
        "keywords": [
          "facepunch",
          "punch",
          "fisted hand sign",
          "people body",
          "hand-fingers-closed"
        ]
      },
      {
        "value": "🤛",
        "keywords": [
          "left-facing fist",
          "left-facing",
          "fist",
          "people body",
          "hand-fingers-closed"
        ]
      },
      {
        "value": "🤜",
        "keywords": [
          "right-facing fist",
          "right-facing",
          "fist",
          "people body",
          "hand-fingers-closed"
        ]
      },
      {
        "value": "👏",
        "keywords": [
          "clap",
          "clapping hands sign",
          "people body",
          "hands"
        ]
      },
      {
        "value": "🙌",
        "keywords": [
          "raised hands",
          "raised",
          "hands",
          "person raising both hands in celebration",
          "people body"
        ]
      },
      {
        "value": "🫶",
        "keywords": [
          "heart hands",
          "heart",
          "hands",
          "people body"
        ]
      },
      {
        "value": "👐",
        "keywords": [
          "open hands",
          "open",
          "hands",
          "open hands sign",
          "people body"
        ]
      },
      {
        "value": "🤲",
        "keywords": [
          "palms up together",
          "palms",
          "up",
          "together",
          "people body",
          "hands"
        ]
      },
      {
        "value": "🤝",
        "keywords": [
          "handshake",
          "people body",
          "hands"
        ]
      },
      {
        "value": "🙏",
        "keywords": [
          "pray",
          "person with folded hands",
          "people body",
          "hands"
        ]
      },
      {
        "value": "✍️",
        "keywords": [
          "writing hand",
          "writing",
          "hand",
          "people body",
          "hand-prop"
        ]
      },
      {
        "value": "💅",
        "keywords": [
          "nail care",
          "nail",
          "care",
          "nail polish",
          "people body",
          "hand-prop"
        ]
      },
      {
        "value": "🤳",
        "keywords": [
          "selfie",
          "people body",
          "hand-prop"
        ]
      },
      {
        "value": "💪",
        "keywords": [
          "muscle",
          "flexed biceps",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🦾",
        "keywords": [
          "mechanical arm",
          "mechanical",
          "arm",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🦿",
        "keywords": [
          "mechanical leg",
          "mechanical",
          "leg",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🦵",
        "keywords": [
          "leg",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🦶",
        "keywords": [
          "foot",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "👂",
        "keywords": [
          "ear",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🦻",
        "keywords": [
          "ear with hearing aid",
          "ear",
          "with",
          "hearing",
          "aid",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "👃",
        "keywords": [
          "nose",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🧠",
        "keywords": [
          "brain",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🫀",
        "keywords": [
          "anatomical heart",
          "anatomical",
          "heart",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🫁",
        "keywords": [
          "lungs",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🦷",
        "keywords": [
          "tooth",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🦴",
        "keywords": [
          "bone",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "👀",
        "keywords": [
          "eyes",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "👁️",
        "keywords": [
          "eye",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "👅",
        "keywords": [
          "tongue",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "👄",
        "keywords": [
          "lips",
          "mouth",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "🫦",
        "keywords": [
          "biting lip",
          "biting",
          "lip",
          "people body",
          "body-parts"
        ]
      },
      {
        "value": "👶",
        "keywords": [
          "baby",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧒",
        "keywords": [
          "child",
          "people body",
          "person"
        ]
      },
      {
        "value": "👦",
        "keywords": [
          "boy",
          "people body",
          "person"
        ]
      },
      {
        "value": "👧",
        "keywords": [
          "girl",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧑",
        "keywords": [
          "adult",
          "people body",
          "person"
        ]
      },
      {
        "value": "👱",
        "keywords": [
          "person with blond hair",
          "person",
          "with",
          "blond",
          "hair",
          "people body"
        ]
      },
      {
        "value": "👨",
        "keywords": [
          "man",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧔",
        "keywords": [
          "bearded person",
          "bearded",
          "person",
          "people body"
        ]
      },
      {
        "value": "🧔‍♂️",
        "keywords": [
          "man with beard",
          "man",
          "with",
          "beard",
          "man beard",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧔‍♀️",
        "keywords": [
          "woman with beard",
          "woman",
          "with",
          "beard",
          "woman beard",
          "people body",
          "person"
        ]
      },
      {
        "value": "👨‍🦰",
        "keywords": [
          "red haired man",
          "red",
          "haired",
          "man",
          "man red hair",
          "people body",
          "person"
        ]
      },
      {
        "value": "👨‍🦱",
        "keywords": [
          "curly haired man",
          "curly",
          "haired",
          "man",
          "man curly hair",
          "people body",
          "person"
        ]
      },
      {
        "value": "👨‍🦳",
        "keywords": [
          "white haired man",
          "white",
          "haired",
          "man",
          "man white hair",
          "people body",
          "person"
        ]
      },
      {
        "value": "👨‍🦲",
        "keywords": [
          "bald man",
          "bald",
          "man",
          "man bald",
          "people body",
          "person"
        ]
      },
      {
        "value": "👩",
        "keywords": [
          "woman",
          "people body",
          "person"
        ]
      },
      {
        "value": "👩‍🦰",
        "keywords": [
          "red haired woman",
          "red",
          "haired",
          "woman",
          "woman red hair",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧑‍🦰",
        "keywords": [
          "red haired person",
          "red",
          "haired",
          "person",
          "person red hair",
          "people body"
        ]
      },
      {
        "value": "👩‍🦱",
        "keywords": [
          "curly haired woman",
          "curly",
          "haired",
          "woman",
          "woman curly hair",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧑‍🦱",
        "keywords": [
          "curly haired person",
          "curly",
          "haired",
          "person",
          "person curly hair",
          "people body"
        ]
      },
      {
        "value": "👩‍🦳",
        "keywords": [
          "white haired woman",
          "white",
          "haired",
          "woman",
          "woman white hair",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧑‍🦳",
        "keywords": [
          "white haired person",
          "white",
          "haired",
          "person",
          "person white hair",
          "people body"
        ]
      },
      {
        "value": "👩‍🦲",
        "keywords": [
          "bald woman",
          "bald",
          "woman",
          "woman bald",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧑‍🦲",
        "keywords": [
          "bald person",
          "bald",
          "person",
          "person bald",
          "people body"
        ]
      },
      {
        "value": "👱‍♀️",
        "keywords": [
          "blond-haired-woman",
          "woman blond hair",
          "people body",
          "person"
        ]
      },
      {
        "value": "👱‍♂️",
        "keywords": [
          "blond-haired-man",
          "man blond hair",
          "people body",
          "person"
        ]
      },
      {
        "value": "🧓",
        "keywords": [
          "older adult",
          "older",
          "adult",
          "people body",
          "person"
        ]
      },
      {
        "value": "👴",
        "keywords": [
          "older man",
          "older",
          "man",
          "people body",
          "person"
        ]
      },
      {
        "value": "👵",
        "keywords": [
          "older woman",
          "older",
          "woman",
          "people body",
          "person"
        ]
      },
      {
        "value": "🙍",
        "keywords": [
          "person frowning",
          "person",
          "frowning",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙍‍♂️",
        "keywords": [
          "man-frowning",
          "man frowning",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙍‍♀️",
        "keywords": [
          "woman-frowning",
          "woman frowning",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙎",
        "keywords": [
          "person with pouting face",
          "person",
          "with",
          "pouting",
          "face",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙎‍♂️",
        "keywords": [
          "man-pouting",
          "man pouting",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙎‍♀️",
        "keywords": [
          "woman-pouting",
          "woman pouting",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙅",
        "keywords": [
          "no good",
          "no",
          "good",
          "face with no good gesture",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙅‍♂️",
        "keywords": [
          "man-gesturing-no",
          "man gesturing no",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙅‍♀️",
        "keywords": [
          "woman-gesturing-no",
          "woman gesturing no",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙆",
        "keywords": [
          "ok woman",
          "ok",
          "woman",
          "face with ok gesture",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙆‍♂️",
        "keywords": [
          "man-gesturing-ok",
          "man gesturing ok",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙆‍♀️",
        "keywords": [
          "woman-gesturing-ok",
          "woman gesturing ok",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "💁",
        "keywords": [
          "information desk person",
          "information",
          "desk",
          "person",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "💁‍♂️",
        "keywords": [
          "man-tipping-hand",
          "man tipping hand",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "💁‍♀️",
        "keywords": [
          "woman-tipping-hand",
          "woman tipping hand",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙋",
        "keywords": [
          "raising hand",
          "raising",
          "hand",
          "happy person raising one hand",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙋‍♂️",
        "keywords": [
          "man-raising-hand",
          "man raising hand",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙋‍♀️",
        "keywords": [
          "woman-raising-hand",
          "woman raising hand",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🧏",
        "keywords": [
          "deaf person",
          "deaf",
          "person",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🧏‍♂️",
        "keywords": [
          "deaf man",
          "deaf",
          "man",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🧏‍♀️",
        "keywords": [
          "deaf woman",
          "deaf",
          "woman",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙇",
        "keywords": [
          "bow",
          "person bowing deeply",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙇‍♂️",
        "keywords": [
          "man-bowing",
          "man bowing",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🙇‍♀️",
        "keywords": [
          "woman-bowing",
          "woman bowing",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🤦",
        "keywords": [
          "face palm",
          "face",
          "palm",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🤦‍♂️",
        "keywords": [
          "man-facepalming",
          "man facepalming",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🤦‍♀️",
        "keywords": [
          "woman-facepalming",
          "woman facepalming",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🤷",
        "keywords": [
          "shrug",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🤷‍♂️",
        "keywords": [
          "man-shrugging",
          "man shrugging",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🤷‍♀️",
        "keywords": [
          "woman-shrugging",
          "woman shrugging",
          "people body",
          "person-gesture"
        ]
      },
      {
        "value": "🧑‍⚕️",
        "keywords": [
          "health worker",
          "health",
          "worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍⚕️",
        "keywords": [
          "male-doctor",
          "man health worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍⚕️",
        "keywords": [
          "female-doctor",
          "woman health worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🎓",
        "keywords": [
          "student",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🎓",
        "keywords": [
          "male-student",
          "man student",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🎓",
        "keywords": [
          "female-student",
          "woman student",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🏫",
        "keywords": [
          "teacher",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🏫",
        "keywords": [
          "male-teacher",
          "man teacher",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🏫",
        "keywords": [
          "female-teacher",
          "woman teacher",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍⚖️",
        "keywords": [
          "judge",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍⚖️",
        "keywords": [
          "male-judge",
          "man judge",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍⚖️",
        "keywords": [
          "female-judge",
          "woman judge",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🌾",
        "keywords": [
          "farmer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🌾",
        "keywords": [
          "male-farmer",
          "man farmer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🌾",
        "keywords": [
          "female-farmer",
          "woman farmer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🍳",
        "keywords": [
          "cook",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🍳",
        "keywords": [
          "male-cook",
          "man cook",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🍳",
        "keywords": [
          "female-cook",
          "woman cook",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🔧",
        "keywords": [
          "mechanic",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🔧",
        "keywords": [
          "male-mechanic",
          "man mechanic",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🔧",
        "keywords": [
          "female-mechanic",
          "woman mechanic",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🏭",
        "keywords": [
          "factory worker",
          "factory",
          "worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🏭",
        "keywords": [
          "male-factory-worker",
          "man factory worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🏭",
        "keywords": [
          "female-factory-worker",
          "woman factory worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍💼",
        "keywords": [
          "office worker",
          "office",
          "worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍💼",
        "keywords": [
          "male-office-worker",
          "man office worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍💼",
        "keywords": [
          "female-office-worker",
          "woman office worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🔬",
        "keywords": [
          "scientist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🔬",
        "keywords": [
          "male-scientist",
          "man scientist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🔬",
        "keywords": [
          "female-scientist",
          "woman scientist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍💻",
        "keywords": [
          "technologist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍💻",
        "keywords": [
          "male-technologist",
          "man technologist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍💻",
        "keywords": [
          "female-technologist",
          "woman technologist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🎤",
        "keywords": [
          "singer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🎤",
        "keywords": [
          "male-singer",
          "man singer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🎤",
        "keywords": [
          "female-singer",
          "woman singer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🎨",
        "keywords": [
          "artist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🎨",
        "keywords": [
          "male-artist",
          "man artist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🎨",
        "keywords": [
          "female-artist",
          "woman artist",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍✈️",
        "keywords": [
          "pilot",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍✈️",
        "keywords": [
          "male-pilot",
          "man pilot",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍✈️",
        "keywords": [
          "female-pilot",
          "woman pilot",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🚀",
        "keywords": [
          "astronaut",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🚀",
        "keywords": [
          "male-astronaut",
          "man astronaut",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🚀",
        "keywords": [
          "female-astronaut",
          "woman astronaut",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🚒",
        "keywords": [
          "firefighter",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🚒",
        "keywords": [
          "male-firefighter",
          "man firefighter",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🚒",
        "keywords": [
          "female-firefighter",
          "woman firefighter",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👮",
        "keywords": [
          "cop",
          "police officer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👮‍♂️",
        "keywords": [
          "male-police-officer",
          "man police officer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👮‍♀️",
        "keywords": [
          "female-police-officer",
          "woman police officer",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🕵️",
        "keywords": [
          "sleuth or spy",
          "sleuth",
          "or",
          "spy",
          "detective",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🕵️‍♂️",
        "keywords": [
          "male-detective",
          "man detective",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🕵️‍♀️",
        "keywords": [
          "female-detective",
          "woman detective",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "💂",
        "keywords": [
          "guardsman",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "💂‍♂️",
        "keywords": [
          "male-guard",
          "man guard",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "💂‍♀️",
        "keywords": [
          "female-guard",
          "woman guard",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🥷",
        "keywords": [
          "ninja",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👷",
        "keywords": [
          "construction worker",
          "construction",
          "worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👷‍♂️",
        "keywords": [
          "male-construction-worker",
          "man construction worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👷‍♀️",
        "keywords": [
          "female-construction-worker",
          "woman construction worker",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🫅",
        "keywords": [
          "person with crown",
          "person",
          "with",
          "crown",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🤴",
        "keywords": [
          "prince",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👸",
        "keywords": [
          "princess",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👳",
        "keywords": [
          "man with turban",
          "man",
          "with",
          "turban",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👳‍♂️",
        "keywords": [
          "man-wearing-turban",
          "man wearing turban",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👳‍♀️",
        "keywords": [
          "woman-wearing-turban",
          "woman wearing turban",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👲",
        "keywords": [
          "man with gua pi mao",
          "man",
          "with",
          "gua",
          "pi",
          "mao",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧕",
        "keywords": [
          "person with headscarf",
          "person",
          "with",
          "headscarf",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🤵",
        "keywords": [
          "person in tuxedo",
          "person",
          "in",
          "tuxedo",
          "man in tuxedo",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🤵‍♂️",
        "keywords": [
          "man in tuxedo",
          "man",
          "in",
          "tuxedo",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🤵‍♀️",
        "keywords": [
          "woman in tuxedo",
          "woman",
          "in",
          "tuxedo",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👰",
        "keywords": [
          "bride with veil",
          "bride",
          "with",
          "veil",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👰‍♂️",
        "keywords": [
          "man with veil",
          "man",
          "with",
          "veil",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👰‍♀️",
        "keywords": [
          "woman with veil",
          "woman",
          "with",
          "veil",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🤰",
        "keywords": [
          "pregnant woman",
          "pregnant",
          "woman",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🫃",
        "keywords": [
          "pregnant man",
          "pregnant",
          "man",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🫄",
        "keywords": [
          "pregnant person",
          "pregnant",
          "person",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🤱",
        "keywords": [
          "breast-feeding",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👩‍🍼",
        "keywords": [
          "woman feeding baby",
          "woman",
          "feeding",
          "baby",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👨‍🍼",
        "keywords": [
          "man feeding baby",
          "man",
          "feeding",
          "baby",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "🧑‍🍼",
        "keywords": [
          "person feeding baby",
          "person",
          "feeding",
          "baby",
          "people body",
          "person-role"
        ]
      },
      {
        "value": "👼",
        "keywords": [
          "angel",
          "baby angel",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🎅",
        "keywords": [
          "santa",
          "father christmas",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🤶",
        "keywords": [
          "mrs claus",
          "mrs",
          "claus",
          "mother christmas",
          "mother",
          "christmas",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧑‍🎄",
        "keywords": [
          "mx claus",
          "mx",
          "claus",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🦸",
        "keywords": [
          "superhero",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🦸‍♂️",
        "keywords": [
          "male superhero",
          "male",
          "superhero",
          "man superhero",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🦸‍♀️",
        "keywords": [
          "female superhero",
          "female",
          "superhero",
          "woman superhero",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🦹",
        "keywords": [
          "supervillain",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🦹‍♂️",
        "keywords": [
          "male supervillain",
          "male",
          "supervillain",
          "man supervillain",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🦹‍♀️",
        "keywords": [
          "female supervillain",
          "female",
          "supervillain",
          "woman supervillain",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧙",
        "keywords": [
          "mage",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧙‍♂️",
        "keywords": [
          "male mage",
          "male",
          "mage",
          "man mage",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧙‍♀️",
        "keywords": [
          "female mage",
          "female",
          "mage",
          "woman mage",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧚",
        "keywords": [
          "fairy",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧚‍♂️",
        "keywords": [
          "male fairy",
          "male",
          "fairy",
          "man fairy",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧚‍♀️",
        "keywords": [
          "female fairy",
          "female",
          "fairy",
          "woman fairy",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧛",
        "keywords": [
          "vampire",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧛‍♂️",
        "keywords": [
          "male vampire",
          "male",
          "vampire",
          "man vampire",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧛‍♀️",
        "keywords": [
          "female vampire",
          "female",
          "vampire",
          "woman vampire",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧜",
        "keywords": [
          "merperson",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧜‍♂️",
        "keywords": [
          "merman",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧜‍♀️",
        "keywords": [
          "mermaid",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧝",
        "keywords": [
          "elf",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧝‍♂️",
        "keywords": [
          "male elf",
          "male",
          "elf",
          "man elf",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧝‍♀️",
        "keywords": [
          "female elf",
          "female",
          "elf",
          "woman elf",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧞",
        "keywords": [
          "genie",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧞‍♂️",
        "keywords": [
          "male genie",
          "male",
          "genie",
          "man genie",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧞‍♀️",
        "keywords": [
          "female genie",
          "female",
          "genie",
          "woman genie",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧟",
        "keywords": [
          "zombie",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧟‍♂️",
        "keywords": [
          "male zombie",
          "male",
          "zombie",
          "man zombie",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧟‍♀️",
        "keywords": [
          "female zombie",
          "female",
          "zombie",
          "woman zombie",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "🧌",
        "keywords": [
          "troll",
          "people body",
          "person-fantasy"
        ]
      },
      {
        "value": "💆",
        "keywords": [
          "massage",
          "face massage",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "💆‍♂️",
        "keywords": [
          "man-getting-massage",
          "man getting massage",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "💆‍♀️",
        "keywords": [
          "woman-getting-massage",
          "woman getting massage",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "💇",
        "keywords": [
          "haircut",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "💇‍♂️",
        "keywords": [
          "man-getting-haircut",
          "man getting haircut",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "💇‍♀️",
        "keywords": [
          "woman-getting-haircut",
          "woman getting haircut",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🚶",
        "keywords": [
          "walking",
          "pedestrian",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🚶‍♂️",
        "keywords": [
          "man-walking",
          "man walking",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🚶‍♀️",
        "keywords": [
          "woman-walking",
          "woman walking",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🚶‍➡️",
        "keywords": [
          "person walking facing right",
          "person",
          "walking",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🚶‍♀️‍➡️",
        "keywords": [
          "woman walking facing right",
          "woman",
          "walking",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🚶‍♂️‍➡️",
        "keywords": [
          "man walking facing right",
          "man",
          "walking",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧍",
        "keywords": [
          "standing person",
          "standing",
          "person",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧍‍♂️",
        "keywords": [
          "man standing",
          "man",
          "standing",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧍‍♀️",
        "keywords": [
          "woman standing",
          "woman",
          "standing",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧎",
        "keywords": [
          "kneeling person",
          "kneeling",
          "person",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧎‍♂️",
        "keywords": [
          "man kneeling",
          "man",
          "kneeling",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧎‍♀️",
        "keywords": [
          "woman kneeling",
          "woman",
          "kneeling",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧎‍➡️",
        "keywords": [
          "person kneeling facing right",
          "person",
          "kneeling",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧎‍♀️‍➡️",
        "keywords": [
          "woman kneeling facing right",
          "woman",
          "kneeling",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧎‍♂️‍➡️",
        "keywords": [
          "man kneeling facing right",
          "man",
          "kneeling",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧑‍🦯",
        "keywords": [
          "person with probing cane",
          "person",
          "with",
          "probing",
          "cane",
          "person with white cane",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧑‍🦯‍➡️",
        "keywords": [
          "person with white cane facing right",
          "person",
          "with",
          "white",
          "cane",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👨‍🦯",
        "keywords": [
          "man with probing cane",
          "man",
          "with",
          "probing",
          "cane",
          "man with white cane",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👨‍🦯‍➡️",
        "keywords": [
          "man with white cane facing right",
          "man",
          "with",
          "white",
          "cane",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👩‍🦯",
        "keywords": [
          "woman with probing cane",
          "woman",
          "with",
          "probing",
          "cane",
          "woman with white cane",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👩‍🦯‍➡️",
        "keywords": [
          "woman with white cane facing right",
          "woman",
          "with",
          "white",
          "cane",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧑‍🦼",
        "keywords": [
          "person in motorized wheelchair",
          "person",
          "in",
          "motorized",
          "wheelchair",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧑‍🦼‍➡️",
        "keywords": [
          "person in motorized wheelchair facing right",
          "person",
          "in",
          "motorized",
          "wheelchair",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👨‍🦼",
        "keywords": [
          "man in motorized wheelchair",
          "man",
          "in",
          "motorized",
          "wheelchair",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👨‍🦼‍➡️",
        "keywords": [
          "man in motorized wheelchair facing right",
          "man",
          "in",
          "motorized",
          "wheelchair",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👩‍🦼",
        "keywords": [
          "woman in motorized wheelchair",
          "woman",
          "in",
          "motorized",
          "wheelchair",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👩‍🦼‍➡️",
        "keywords": [
          "woman in motorized wheelchair facing right",
          "woman",
          "in",
          "motorized",
          "wheelchair",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧑‍🦽",
        "keywords": [
          "person in manual wheelchair",
          "person",
          "in",
          "manual",
          "wheelchair",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧑‍🦽‍➡️",
        "keywords": [
          "person in manual wheelchair facing right",
          "person",
          "in",
          "manual",
          "wheelchair",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👨‍🦽",
        "keywords": [
          "man in manual wheelchair",
          "man",
          "in",
          "manual",
          "wheelchair",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👨‍🦽‍➡️",
        "keywords": [
          "man in manual wheelchair facing right",
          "man",
          "in",
          "manual",
          "wheelchair",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👩‍🦽",
        "keywords": [
          "woman in manual wheelchair",
          "woman",
          "in",
          "manual",
          "wheelchair",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👩‍🦽‍➡️",
        "keywords": [
          "woman in manual wheelchair facing right",
          "woman",
          "in",
          "manual",
          "wheelchair",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🏃",
        "keywords": [
          "runner",
          "running",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🏃‍♂️",
        "keywords": [
          "man-running",
          "man running",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🏃‍♀️",
        "keywords": [
          "woman-running",
          "woman running",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🏃‍➡️",
        "keywords": [
          "person running facing right",
          "person",
          "running",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🏃‍♀️‍➡️",
        "keywords": [
          "woman running facing right",
          "woman",
          "running",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🏃‍♂️‍➡️",
        "keywords": [
          "man running facing right",
          "man",
          "running",
          "facing",
          "right",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "💃",
        "keywords": [
          "dancer",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🕺",
        "keywords": [
          "man dancing",
          "man",
          "dancing",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🕴️",
        "keywords": [
          "man in business suit levitating",
          "man",
          "in",
          "business",
          "suit",
          "levitating",
          "person in suit levitating",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👯",
        "keywords": [
          "dancers",
          "woman with bunny ears",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👯‍♂️",
        "keywords": [
          "men-with-bunny-ears-partying",
          "man-with-bunny-ears-partying",
          "men with bunny ears",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "👯‍♀️",
        "keywords": [
          "women-with-bunny-ears-partying",
          "woman-with-bunny-ears-partying",
          "women with bunny ears",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧖",
        "keywords": [
          "person in steamy room",
          "person",
          "in",
          "steamy",
          "room",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧖‍♂️",
        "keywords": [
          "man in steamy room",
          "man",
          "in",
          "steamy",
          "room",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧖‍♀️",
        "keywords": [
          "woman in steamy room",
          "woman",
          "in",
          "steamy",
          "room",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧗",
        "keywords": [
          "person climbing",
          "person",
          "climbing",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧗‍♂️",
        "keywords": [
          "man climbing",
          "man",
          "climbing",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🧗‍♀️",
        "keywords": [
          "woman climbing",
          "woman",
          "climbing",
          "people body",
          "person-activity"
        ]
      },
      {
        "value": "🤺",
        "keywords": [
          "fencer",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏇",
        "keywords": [
          "horse racing",
          "horse",
          "racing",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "⛷️",
        "keywords": [
          "skier",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏂",
        "keywords": [
          "snowboarder",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏌️",
        "keywords": [
          "golfer",
          "person golfing",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏌️‍♂️",
        "keywords": [
          "man-golfing",
          "man golfing",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏌️‍♀️",
        "keywords": [
          "woman-golfing",
          "woman golfing",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏄",
        "keywords": [
          "surfer",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏄‍♂️",
        "keywords": [
          "man-surfing",
          "man surfing",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏄‍♀️",
        "keywords": [
          "woman-surfing",
          "woman surfing",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚣",
        "keywords": [
          "rowboat",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚣‍♂️",
        "keywords": [
          "man-rowing-boat",
          "man rowing boat",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚣‍♀️",
        "keywords": [
          "woman-rowing-boat",
          "woman rowing boat",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏊",
        "keywords": [
          "swimmer",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏊‍♂️",
        "keywords": [
          "man-swimming",
          "man swimming",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏊‍♀️",
        "keywords": [
          "woman-swimming",
          "woman swimming",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "⛹️",
        "keywords": [
          "person with ball",
          "person",
          "with",
          "ball",
          "person bouncing ball",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "⛹️‍♂️",
        "keywords": [
          "man-bouncing-ball",
          "man bouncing ball",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "⛹️‍♀️",
        "keywords": [
          "woman-bouncing-ball",
          "woman bouncing ball",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏋️",
        "keywords": [
          "weight lifter",
          "weight",
          "lifter",
          "person lifting weights",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏋️‍♂️",
        "keywords": [
          "man-lifting-weights",
          "man lifting weights",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🏋️‍♀️",
        "keywords": [
          "woman-lifting-weights",
          "woman lifting weights",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚴",
        "keywords": [
          "bicyclist",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚴‍♂️",
        "keywords": [
          "man-biking",
          "man biking",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚴‍♀️",
        "keywords": [
          "woman-biking",
          "woman biking",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚵",
        "keywords": [
          "mountain bicyclist",
          "mountain",
          "bicyclist",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚵‍♂️",
        "keywords": [
          "man-mountain-biking",
          "man mountain biking",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🚵‍♀️",
        "keywords": [
          "woman-mountain-biking",
          "woman mountain biking",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤸",
        "keywords": [
          "person doing cartwheel",
          "person",
          "doing",
          "cartwheel",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤸‍♂️",
        "keywords": [
          "man-cartwheeling",
          "man cartwheeling",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤸‍♀️",
        "keywords": [
          "woman-cartwheeling",
          "woman cartwheeling",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤼",
        "keywords": [
          "wrestlers",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤼‍♂️",
        "keywords": [
          "man-wrestling",
          "men wrestling",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤼‍♀️",
        "keywords": [
          "woman-wrestling",
          "women wrestling",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤽",
        "keywords": [
          "water polo",
          "water",
          "polo",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤽‍♂️",
        "keywords": [
          "man-playing-water-polo",
          "man playing water polo",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤽‍♀️",
        "keywords": [
          "woman-playing-water-polo",
          "woman playing water polo",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤾",
        "keywords": [
          "handball",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤾‍♂️",
        "keywords": [
          "man-playing-handball",
          "man playing handball",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤾‍♀️",
        "keywords": [
          "woman-playing-handball",
          "woman playing handball",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤹",
        "keywords": [
          "juggling",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤹‍♂️",
        "keywords": [
          "man-juggling",
          "man juggling",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🤹‍♀️",
        "keywords": [
          "woman-juggling",
          "woman juggling",
          "people body",
          "person-sport"
        ]
      },
      {
        "value": "🧘",
        "keywords": [
          "person in lotus position",
          "person",
          "in",
          "lotus",
          "position",
          "people body",
          "person-resting"
        ]
      },
      {
        "value": "🧘‍♂️",
        "keywords": [
          "man in lotus position",
          "man",
          "in",
          "lotus",
          "position",
          "people body",
          "person-resting"
        ]
      },
      {
        "value": "🧘‍♀️",
        "keywords": [
          "woman in lotus position",
          "woman",
          "in",
          "lotus",
          "position",
          "people body",
          "person-resting"
        ]
      },
      {
        "value": "🛀",
        "keywords": [
          "bath",
          "people body",
          "person-resting"
        ]
      },
      {
        "value": "🛌",
        "keywords": [
          "sleeping accommodation",
          "sleeping",
          "accommodation",
          "people body",
          "person-resting"
        ]
      },
      {
        "value": "🧑‍🤝‍🧑",
        "keywords": [
          "people holding hands",
          "people",
          "holding",
          "hands",
          "people body",
          "family"
        ]
      },
      {
        "value": "👭",
        "keywords": [
          "two women holding hands",
          "two",
          "women",
          "holding",
          "hands",
          "women holding hands",
          "people body",
          "family"
        ]
      },
      {
        "value": "👫",
        "keywords": [
          "man and woman holding hands",
          "man",
          "and",
          "woman",
          "holding",
          "hands",
          "woman and man holding hands",
          "couple",
          "people body",
          "family"
        ]
      },
      {
        "value": "👬",
        "keywords": [
          "two men holding hands",
          "two",
          "men",
          "holding",
          "hands",
          "men holding hands",
          "people body",
          "family"
        ]
      },
      {
        "value": "💏",
        "keywords": [
          "couplekiss",
          "kiss",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍❤️‍💋‍👨",
        "keywords": [
          "woman-kiss-man",
          "kiss woman man",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍❤️‍💋‍👨",
        "keywords": [
          "man-kiss-man",
          "kiss man man",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍❤️‍💋‍👩",
        "keywords": [
          "woman-kiss-woman",
          "kiss woman woman",
          "people body",
          "family"
        ]
      },
      {
        "value": "💑",
        "keywords": [
          "couple with heart",
          "couple",
          "with",
          "heart",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍❤️‍👨",
        "keywords": [
          "woman-heart-man",
          "couple with heart woman man",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍❤️‍👨",
        "keywords": [
          "man-heart-man",
          "couple with heart man man",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍❤️‍👩",
        "keywords": [
          "woman-heart-woman",
          "couple with heart woman woman",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👩‍👦",
        "keywords": [
          "man-woman-boy",
          "family man woman boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👩‍👧",
        "keywords": [
          "man-woman-girl",
          "family man woman girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👩‍👧‍👦",
        "keywords": [
          "man-woman-girl-boy",
          "family man woman girl boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👩‍👦‍👦",
        "keywords": [
          "man-woman-boy-boy",
          "family man woman boy boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👩‍👧‍👧",
        "keywords": [
          "man-woman-girl-girl",
          "family man woman girl girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👨‍👦",
        "keywords": [
          "man-man-boy",
          "family man man boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👨‍👧",
        "keywords": [
          "man-man-girl",
          "family man man girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👨‍👧‍👦",
        "keywords": [
          "man-man-girl-boy",
          "family man man girl boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👨‍👦‍👦",
        "keywords": [
          "man-man-boy-boy",
          "family man man boy boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👨‍👧‍👧",
        "keywords": [
          "man-man-girl-girl",
          "family man man girl girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👩‍👦",
        "keywords": [
          "woman-woman-boy",
          "family woman woman boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👩‍👧",
        "keywords": [
          "woman-woman-girl",
          "family woman woman girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👩‍👧‍👦",
        "keywords": [
          "woman-woman-girl-boy",
          "family woman woman girl boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👩‍👦‍👦",
        "keywords": [
          "woman-woman-boy-boy",
          "family woman woman boy boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👩‍👧‍👧",
        "keywords": [
          "woman-woman-girl-girl",
          "family woman woman girl girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👦",
        "keywords": [
          "man-boy",
          "family man boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👦‍👦",
        "keywords": [
          "man-boy-boy",
          "family man boy boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👧",
        "keywords": [
          "man-girl",
          "family man girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👧‍👦",
        "keywords": [
          "man-girl-boy",
          "family man girl boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👨‍👧‍👧",
        "keywords": [
          "man-girl-girl",
          "family man girl girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👦",
        "keywords": [
          "woman-boy",
          "family woman boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👦‍👦",
        "keywords": [
          "woman-boy-boy",
          "family woman boy boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👧",
        "keywords": [
          "woman-girl",
          "family woman girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👧‍👦",
        "keywords": [
          "woman-girl-boy",
          "family woman girl boy",
          "people body",
          "family"
        ]
      },
      {
        "value": "👩‍👧‍👧",
        "keywords": [
          "woman-girl-girl",
          "family woman girl girl",
          "people body",
          "family"
        ]
      },
      {
        "value": "🗣️",
        "keywords": [
          "speaking head in silhouette",
          "speaking",
          "head",
          "in",
          "silhouette",
          "speaking head",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "👤",
        "keywords": [
          "bust in silhouette",
          "bust",
          "in",
          "silhouette",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "👥",
        "keywords": [
          "busts in silhouette",
          "busts",
          "in",
          "silhouette",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "🫂",
        "keywords": [
          "people hugging",
          "people",
          "hugging",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "👪",
        "keywords": [
          "family",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "🧑‍🧑‍🧒",
        "keywords": [
          "family adult adult child",
          "family",
          "adult",
          "child",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "🧑‍🧑‍🧒‍🧒",
        "keywords": [
          "family adult adult child child",
          "family",
          "adult",
          "child",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "🧑‍🧒",
        "keywords": [
          "family adult child",
          "family",
          "adult",
          "child",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "🧑‍🧒‍🧒",
        "keywords": [
          "family adult child child",
          "family",
          "adult",
          "child",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "👣",
        "keywords": [
          "footprints",
          "people body",
          "person-symbol"
        ]
      },
      {
        "value": "🫆",
        "keywords": [
          "fingerprint",
          "people body",
          "person-symbol"
        ]
      }
    ]
  },
  {
    "id": "animals",
    "label": "Natureza",
    "nativeLabel": "Animais e natureza",
    "emojis": [
      {
        "value": "🐵",
        "keywords": [
          "monkey face",
          "monkey",
          "face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐒",
        "keywords": [
          "monkey",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦍",
        "keywords": [
          "gorilla",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦧",
        "keywords": [
          "orangutan",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐶",
        "keywords": [
          "dog",
          "dog face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐕",
        "keywords": [
          "dog2",
          "dog",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦮",
        "keywords": [
          "guide dog",
          "guide",
          "dog",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐕‍🦺",
        "keywords": [
          "service dog",
          "service",
          "dog",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐩",
        "keywords": [
          "poodle",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐺",
        "keywords": [
          "wolf",
          "wolf face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦊",
        "keywords": [
          "fox face",
          "fox",
          "face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦝",
        "keywords": [
          "raccoon",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐱",
        "keywords": [
          "cat",
          "cat face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐈",
        "keywords": [
          "cat2",
          "cat",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐈‍⬛",
        "keywords": [
          "black cat",
          "black",
          "cat",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦁",
        "keywords": [
          "lion face",
          "lion",
          "face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐯",
        "keywords": [
          "tiger",
          "tiger face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐅",
        "keywords": [
          "tiger2",
          "tiger",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐆",
        "keywords": [
          "leopard",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐴",
        "keywords": [
          "horse",
          "horse face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🫎",
        "keywords": [
          "moose",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🫏",
        "keywords": [
          "donkey",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐎",
        "keywords": [
          "racehorse",
          "horse",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦄",
        "keywords": [
          "unicorn face",
          "unicorn",
          "face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦓",
        "keywords": [
          "zebra face",
          "zebra",
          "face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦌",
        "keywords": [
          "deer",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦬",
        "keywords": [
          "bison",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐮",
        "keywords": [
          "cow",
          "cow face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐂",
        "keywords": [
          "ox",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐃",
        "keywords": [
          "water buffalo",
          "water",
          "buffalo",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐄",
        "keywords": [
          "cow2",
          "cow",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐷",
        "keywords": [
          "pig",
          "pig face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐖",
        "keywords": [
          "pig2",
          "pig",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐗",
        "keywords": [
          "boar",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐽",
        "keywords": [
          "pig nose",
          "pig",
          "nose",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐏",
        "keywords": [
          "ram",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐑",
        "keywords": [
          "sheep",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐐",
        "keywords": [
          "goat",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐪",
        "keywords": [
          "dromedary camel",
          "dromedary",
          "camel",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐫",
        "keywords": [
          "camel",
          "bactrian camel",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦙",
        "keywords": [
          "llama",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦒",
        "keywords": [
          "giraffe face",
          "giraffe",
          "face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐘",
        "keywords": [
          "elephant",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦣",
        "keywords": [
          "mammoth",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦏",
        "keywords": [
          "rhinoceros",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦛",
        "keywords": [
          "hippopotamus",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐭",
        "keywords": [
          "mouse",
          "mouse face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐁",
        "keywords": [
          "mouse2",
          "mouse",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐀",
        "keywords": [
          "rat",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐹",
        "keywords": [
          "hamster",
          "hamster face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐰",
        "keywords": [
          "rabbit",
          "rabbit face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐇",
        "keywords": [
          "rabbit2",
          "rabbit",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐿️",
        "keywords": [
          "chipmunk",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦫",
        "keywords": [
          "beaver",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦔",
        "keywords": [
          "hedgehog",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦇",
        "keywords": [
          "bat",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐻",
        "keywords": [
          "bear",
          "bear face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐻‍❄️",
        "keywords": [
          "polar bear",
          "polar",
          "bear",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐨",
        "keywords": [
          "koala",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐼",
        "keywords": [
          "panda face",
          "panda",
          "face",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦥",
        "keywords": [
          "sloth",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦦",
        "keywords": [
          "otter",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦨",
        "keywords": [
          "skunk",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦘",
        "keywords": [
          "kangaroo",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦡",
        "keywords": [
          "badger",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🐾",
        "keywords": [
          "feet",
          "paw prints",
          "paw",
          "prints",
          "animals nature",
          "animal-mammal"
        ]
      },
      {
        "value": "🦃",
        "keywords": [
          "turkey",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐔",
        "keywords": [
          "chicken",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐓",
        "keywords": [
          "rooster",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐣",
        "keywords": [
          "hatching chick",
          "hatching",
          "chick",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐤",
        "keywords": [
          "baby chick",
          "baby",
          "chick",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐥",
        "keywords": [
          "hatched chick",
          "hatched",
          "chick",
          "front-facing baby chick",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐦",
        "keywords": [
          "bird",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐧",
        "keywords": [
          "penguin",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🕊️",
        "keywords": [
          "dove of peace",
          "dove",
          "of",
          "peace",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🦅",
        "keywords": [
          "eagle",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🦆",
        "keywords": [
          "duck",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🦢",
        "keywords": [
          "swan",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🦉",
        "keywords": [
          "owl",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🦤",
        "keywords": [
          "dodo",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🪶",
        "keywords": [
          "feather",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🦩",
        "keywords": [
          "flamingo",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🦚",
        "keywords": [
          "peacock",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🦜",
        "keywords": [
          "parrot",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🪽",
        "keywords": [
          "wing",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐦‍⬛",
        "keywords": [
          "black bird",
          "black",
          "bird",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🪿",
        "keywords": [
          "goose",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐦‍🔥",
        "keywords": [
          "phoenix",
          "animals nature",
          "animal-bird"
        ]
      },
      {
        "value": "🐸",
        "keywords": [
          "frog",
          "frog face",
          "animals nature",
          "animal-amphibian"
        ]
      },
      {
        "value": "🐊",
        "keywords": [
          "crocodile",
          "animals nature",
          "animal-reptile"
        ]
      },
      {
        "value": "🐢",
        "keywords": [
          "turtle",
          "animals nature",
          "animal-reptile"
        ]
      },
      {
        "value": "🦎",
        "keywords": [
          "lizard",
          "animals nature",
          "animal-reptile"
        ]
      },
      {
        "value": "🐍",
        "keywords": [
          "snake",
          "animals nature",
          "animal-reptile"
        ]
      },
      {
        "value": "🐲",
        "keywords": [
          "dragon face",
          "dragon",
          "face",
          "animals nature",
          "animal-reptile"
        ]
      },
      {
        "value": "🐉",
        "keywords": [
          "dragon",
          "animals nature",
          "animal-reptile"
        ]
      },
      {
        "value": "🦕",
        "keywords": [
          "sauropod",
          "animals nature",
          "animal-reptile"
        ]
      },
      {
        "value": "🦖",
        "keywords": [
          "t-rex",
          "animals nature",
          "animal-reptile"
        ]
      },
      {
        "value": "🐳",
        "keywords": [
          "whale",
          "spouting whale",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🐋",
        "keywords": [
          "whale2",
          "whale",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🐬",
        "keywords": [
          "dolphin",
          "flipper",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🦭",
        "keywords": [
          "seal",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🐟",
        "keywords": [
          "fish",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🐠",
        "keywords": [
          "tropical fish",
          "tropical",
          "fish",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🐡",
        "keywords": [
          "blowfish",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🦈",
        "keywords": [
          "shark",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🐙",
        "keywords": [
          "octopus",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🐚",
        "keywords": [
          "shell",
          "spiral shell",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🪸",
        "keywords": [
          "coral",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🪼",
        "keywords": [
          "jellyfish",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🦀",
        "keywords": [
          "crab",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🦞",
        "keywords": [
          "lobster",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🦐",
        "keywords": [
          "shrimp",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🦑",
        "keywords": [
          "squid",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🦪",
        "keywords": [
          "oyster",
          "animals nature",
          "animal-marine"
        ]
      },
      {
        "value": "🐌",
        "keywords": [
          "snail",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🦋",
        "keywords": [
          "butterfly",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🐛",
        "keywords": [
          "bug",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🐜",
        "keywords": [
          "ant",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🐝",
        "keywords": [
          "bee",
          "honeybee",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🪲",
        "keywords": [
          "beetle",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🐞",
        "keywords": [
          "ladybug",
          "lady beetle",
          "lady",
          "beetle",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🦗",
        "keywords": [
          "cricket",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🪳",
        "keywords": [
          "cockroach",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🕷️",
        "keywords": [
          "spider",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🕸️",
        "keywords": [
          "spider web",
          "spider",
          "web",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🦂",
        "keywords": [
          "scorpion",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🦟",
        "keywords": [
          "mosquito",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🪰",
        "keywords": [
          "fly",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🪱",
        "keywords": [
          "worm",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "🦠",
        "keywords": [
          "microbe",
          "animals nature",
          "animal-bug"
        ]
      },
      {
        "value": "💐",
        "keywords": [
          "bouquet",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🌸",
        "keywords": [
          "cherry blossom",
          "cherry",
          "blossom",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "💮",
        "keywords": [
          "white flower",
          "white",
          "flower",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🪷",
        "keywords": [
          "lotus",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🏵️",
        "keywords": [
          "rosette",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🌹",
        "keywords": [
          "rose",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🥀",
        "keywords": [
          "wilted flower",
          "wilted",
          "flower",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🌺",
        "keywords": [
          "hibiscus",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🌻",
        "keywords": [
          "sunflower",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🌼",
        "keywords": [
          "blossom",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🌷",
        "keywords": [
          "tulip",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🪻",
        "keywords": [
          "hyacinth",
          "animals nature",
          "plant-flower"
        ]
      },
      {
        "value": "🌱",
        "keywords": [
          "seedling",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🪴",
        "keywords": [
          "potted plant",
          "potted",
          "plant",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🌲",
        "keywords": [
          "evergreen tree",
          "evergreen",
          "tree",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🌳",
        "keywords": [
          "deciduous tree",
          "deciduous",
          "tree",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🌴",
        "keywords": [
          "palm tree",
          "palm",
          "tree",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🌵",
        "keywords": [
          "cactus",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🌾",
        "keywords": [
          "ear of rice",
          "ear",
          "of",
          "rice",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🌿",
        "keywords": [
          "herb",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "☘️",
        "keywords": [
          "shamrock",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🍀",
        "keywords": [
          "four leaf clover",
          "four",
          "leaf",
          "clover",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🍁",
        "keywords": [
          "maple leaf",
          "maple",
          "leaf",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🍂",
        "keywords": [
          "fallen leaf",
          "fallen",
          "leaf",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🍃",
        "keywords": [
          "leaves",
          "leaf fluttering in wind",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🪹",
        "keywords": [
          "empty nest",
          "empty",
          "nest",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🪺",
        "keywords": [
          "nest with eggs",
          "nest",
          "with",
          "eggs",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🍄",
        "keywords": [
          "mushroom",
          "animals nature",
          "plant-other"
        ]
      },
      {
        "value": "🪾",
        "keywords": [
          "leafless tree",
          "leafless",
          "tree",
          "animals nature",
          "plant-other"
        ]
      }
    ]
  },
  {
    "id": "food",
    "label": "Comidas",
    "nativeLabel": "Comidas e bebidas",
    "emojis": [
      {
        "value": "🍇",
        "keywords": [
          "grapes",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍈",
        "keywords": [
          "melon",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍉",
        "keywords": [
          "watermelon",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍊",
        "keywords": [
          "tangerine",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍋",
        "keywords": [
          "lemon",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍋‍🟩",
        "keywords": [
          "lime",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍌",
        "keywords": [
          "banana",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍍",
        "keywords": [
          "pineapple",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🥭",
        "keywords": [
          "mango",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍎",
        "keywords": [
          "apple",
          "red apple",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍏",
        "keywords": [
          "green apple",
          "green",
          "apple",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍐",
        "keywords": [
          "pear",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍑",
        "keywords": [
          "peach",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍒",
        "keywords": [
          "cherries",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍓",
        "keywords": [
          "strawberry",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🫐",
        "keywords": [
          "blueberries",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🥝",
        "keywords": [
          "kiwifruit",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🍅",
        "keywords": [
          "tomato",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🫒",
        "keywords": [
          "olive",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🥥",
        "keywords": [
          "coconut",
          "food drink",
          "food-fruit"
        ]
      },
      {
        "value": "🥑",
        "keywords": [
          "avocado",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🍆",
        "keywords": [
          "eggplant",
          "aubergine",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🥔",
        "keywords": [
          "potato",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🥕",
        "keywords": [
          "carrot",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🌽",
        "keywords": [
          "corn",
          "ear of maize",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🌶️",
        "keywords": [
          "hot pepper",
          "hot",
          "pepper",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🫑",
        "keywords": [
          "bell pepper",
          "bell",
          "pepper",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🥒",
        "keywords": [
          "cucumber",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🥬",
        "keywords": [
          "leafy green",
          "leafy",
          "green",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🥦",
        "keywords": [
          "broccoli",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🧄",
        "keywords": [
          "garlic",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🧅",
        "keywords": [
          "onion",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🥜",
        "keywords": [
          "peanuts",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🫘",
        "keywords": [
          "beans",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🌰",
        "keywords": [
          "chestnut",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🫚",
        "keywords": [
          "ginger root",
          "ginger",
          "root",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🫛",
        "keywords": [
          "pea pod",
          "pea",
          "pod",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🍄‍🟫",
        "keywords": [
          "brown mushroom",
          "brown",
          "mushroom",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🫜",
        "keywords": [
          "root vegetable",
          "root",
          "vegetable",
          "food drink",
          "food-vegetable"
        ]
      },
      {
        "value": "🍞",
        "keywords": [
          "bread",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥐",
        "keywords": [
          "croissant",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥖",
        "keywords": [
          "baguette bread",
          "baguette",
          "bread",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🫓",
        "keywords": [
          "flatbread",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥨",
        "keywords": [
          "pretzel",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥯",
        "keywords": [
          "bagel",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥞",
        "keywords": [
          "pancakes",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🧇",
        "keywords": [
          "waffle",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🧀",
        "keywords": [
          "cheese wedge",
          "cheese",
          "wedge",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍖",
        "keywords": [
          "meat on bone",
          "meat",
          "on",
          "bone",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍗",
        "keywords": [
          "poultry leg",
          "poultry",
          "leg",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥩",
        "keywords": [
          "cut of meat",
          "cut",
          "of",
          "meat",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥓",
        "keywords": [
          "bacon",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍔",
        "keywords": [
          "hamburger",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍟",
        "keywords": [
          "fries",
          "french fries",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍕",
        "keywords": [
          "pizza",
          "slice of pizza",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🌭",
        "keywords": [
          "hotdog",
          "hot dog",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥪",
        "keywords": [
          "sandwich",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🌮",
        "keywords": [
          "taco",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🌯",
        "keywords": [
          "burrito",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🫔",
        "keywords": [
          "tamale",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥙",
        "keywords": [
          "stuffed flatbread",
          "stuffed",
          "flatbread",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🧆",
        "keywords": [
          "falafel",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥚",
        "keywords": [
          "egg",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍳",
        "keywords": [
          "fried egg",
          "fried",
          "egg",
          "cooking",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥘",
        "keywords": [
          "shallow pan of food",
          "shallow",
          "pan",
          "of",
          "food",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍲",
        "keywords": [
          "stew",
          "pot of food",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🫕",
        "keywords": [
          "fondue",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥣",
        "keywords": [
          "bowl with spoon",
          "bowl",
          "with",
          "spoon",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥗",
        "keywords": [
          "green salad",
          "green",
          "salad",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍿",
        "keywords": [
          "popcorn",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🧈",
        "keywords": [
          "butter",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🧂",
        "keywords": [
          "salt",
          "salt shaker",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🥫",
        "keywords": [
          "canned food",
          "canned",
          "food",
          "food drink",
          "food-prepared"
        ]
      },
      {
        "value": "🍱",
        "keywords": [
          "bento",
          "bento box",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍘",
        "keywords": [
          "rice cracker",
          "rice",
          "cracker",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍙",
        "keywords": [
          "rice ball",
          "rice",
          "ball",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍚",
        "keywords": [
          "rice",
          "cooked rice",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍛",
        "keywords": [
          "curry",
          "curry and rice",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍜",
        "keywords": [
          "ramen",
          "steaming bowl",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍝",
        "keywords": [
          "spaghetti",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍠",
        "keywords": [
          "sweet potato",
          "sweet",
          "potato",
          "roasted sweet potato",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍢",
        "keywords": [
          "oden",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍣",
        "keywords": [
          "sushi",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍤",
        "keywords": [
          "fried shrimp",
          "fried",
          "shrimp",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍥",
        "keywords": [
          "fish cake",
          "fish",
          "cake",
          "fish cake with swirl design",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🥮",
        "keywords": [
          "moon cake",
          "moon",
          "cake",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍡",
        "keywords": [
          "dango",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🥟",
        "keywords": [
          "dumpling",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🥠",
        "keywords": [
          "fortune cookie",
          "fortune",
          "cookie",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🥡",
        "keywords": [
          "takeout box",
          "takeout",
          "box",
          "food drink",
          "food-asian"
        ]
      },
      {
        "value": "🍦",
        "keywords": [
          "icecream",
          "soft ice cream",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍧",
        "keywords": [
          "shaved ice",
          "shaved",
          "ice",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍨",
        "keywords": [
          "ice cream",
          "ice",
          "cream",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍩",
        "keywords": [
          "doughnut",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍪",
        "keywords": [
          "cookie",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🎂",
        "keywords": [
          "birthday",
          "birthday cake",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍰",
        "keywords": [
          "cake",
          "shortcake",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🧁",
        "keywords": [
          "cupcake",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🥧",
        "keywords": [
          "pie",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍫",
        "keywords": [
          "chocolate bar",
          "chocolate",
          "bar",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍬",
        "keywords": [
          "candy",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍭",
        "keywords": [
          "lollipop",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍮",
        "keywords": [
          "custard",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍯",
        "keywords": [
          "honey pot",
          "honey",
          "pot",
          "food drink",
          "food-sweet"
        ]
      },
      {
        "value": "🍼",
        "keywords": [
          "baby bottle",
          "baby",
          "bottle",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🥛",
        "keywords": [
          "glass of milk",
          "glass",
          "of",
          "milk",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "☕",
        "keywords": [
          "coffee",
          "hot beverage",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🫖",
        "keywords": [
          "teapot",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🍵",
        "keywords": [
          "tea",
          "teacup without handle",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🍶",
        "keywords": [
          "sake",
          "sake bottle and cup",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🍾",
        "keywords": [
          "champagne",
          "bottle with popping cork",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🍷",
        "keywords": [
          "wine glass",
          "wine",
          "glass",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🍸",
        "keywords": [
          "cocktail",
          "cocktail glass",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🍹",
        "keywords": [
          "tropical drink",
          "tropical",
          "drink",
          "food drink"
        ]
      },
      {
        "value": "🍺",
        "keywords": [
          "beer",
          "beer mug",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🍻",
        "keywords": [
          "beers",
          "clinking beer mugs",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🥂",
        "keywords": [
          "clinking glasses",
          "clinking",
          "glasses",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🥃",
        "keywords": [
          "tumbler glass",
          "tumbler",
          "glass",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🫗",
        "keywords": [
          "pouring liquid",
          "pouring",
          "liquid",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🥤",
        "keywords": [
          "cup with straw",
          "cup",
          "with",
          "straw",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🧋",
        "keywords": [
          "bubble tea",
          "bubble",
          "tea",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🧃",
        "keywords": [
          "beverage box",
          "beverage",
          "box",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🧉",
        "keywords": [
          "mate drink",
          "mate",
          "drink",
          "food drink"
        ]
      },
      {
        "value": "🧊",
        "keywords": [
          "ice cube",
          "ice",
          "cube",
          "food drink",
          "drink"
        ]
      },
      {
        "value": "🥢",
        "keywords": [
          "chopsticks",
          "food drink",
          "dishware"
        ]
      },
      {
        "value": "🍽️",
        "keywords": [
          "knife fork plate",
          "knife",
          "fork",
          "plate",
          "fork and knife with plate",
          "food drink",
          "dishware"
        ]
      },
      {
        "value": "🍴",
        "keywords": [
          "fork and knife",
          "fork",
          "and",
          "knife",
          "food drink",
          "dishware"
        ]
      },
      {
        "value": "🥄",
        "keywords": [
          "spoon",
          "food drink",
          "dishware"
        ]
      },
      {
        "value": "🔪",
        "keywords": [
          "hocho",
          "knife",
          "food drink",
          "dishware"
        ]
      },
      {
        "value": "🫙",
        "keywords": [
          "jar",
          "food drink",
          "dishware"
        ]
      },
      {
        "value": "🏺",
        "keywords": [
          "amphora",
          "food drink",
          "dishware"
        ]
      }
    ]
  },
  {
    "id": "activities",
    "label": "Atividades",
    "nativeLabel": "Atividades",
    "emojis": [
      {
        "value": "🎃",
        "keywords": [
          "jack o lantern",
          "jack",
          "o",
          "lantern",
          "jack-o-lantern",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎄",
        "keywords": [
          "christmas tree",
          "christmas",
          "tree",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎆",
        "keywords": [
          "fireworks",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎇",
        "keywords": [
          "sparkler",
          "firework sparkler",
          "activities",
          "event"
        ]
      },
      {
        "value": "🧨",
        "keywords": [
          "firecracker",
          "activities",
          "event"
        ]
      },
      {
        "value": "✨",
        "keywords": [
          "sparkles",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎈",
        "keywords": [
          "balloon",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎉",
        "keywords": [
          "tada",
          "party popper",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎊",
        "keywords": [
          "confetti ball",
          "confetti",
          "ball",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎋",
        "keywords": [
          "tanabata tree",
          "tanabata",
          "tree",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎍",
        "keywords": [
          "bamboo",
          "pine decoration",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎎",
        "keywords": [
          "dolls",
          "japanese dolls",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎏",
        "keywords": [
          "flags",
          "carp streamer",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎐",
        "keywords": [
          "wind chime",
          "wind",
          "chime",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎑",
        "keywords": [
          "rice scene",
          "rice",
          "scene",
          "moon viewing ceremony",
          "activities",
          "event"
        ]
      },
      {
        "value": "🧧",
        "keywords": [
          "red envelope",
          "red",
          "envelope",
          "red gift envelope",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎀",
        "keywords": [
          "ribbon",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎁",
        "keywords": [
          "gift",
          "wrapped present",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎗️",
        "keywords": [
          "reminder ribbon",
          "reminder",
          "ribbon",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎟️",
        "keywords": [
          "admission tickets",
          "admission",
          "tickets",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎫",
        "keywords": [
          "ticket",
          "activities",
          "event"
        ]
      },
      {
        "value": "🎖️",
        "keywords": [
          "medal",
          "military medal",
          "activities",
          "award-medal"
        ]
      },
      {
        "value": "🏆",
        "keywords": [
          "trophy",
          "activities",
          "award-medal"
        ]
      },
      {
        "value": "🏅",
        "keywords": [
          "sports medal",
          "sports",
          "medal",
          "activities",
          "award-medal"
        ]
      },
      {
        "value": "🥇",
        "keywords": [
          "first place medal",
          "first",
          "place",
          "medal",
          "activities",
          "award-medal"
        ]
      },
      {
        "value": "🥈",
        "keywords": [
          "second place medal",
          "second",
          "place",
          "medal",
          "activities",
          "award-medal"
        ]
      },
      {
        "value": "🥉",
        "keywords": [
          "third place medal",
          "third",
          "place",
          "medal",
          "activities",
          "award-medal"
        ]
      },
      {
        "value": "⚽",
        "keywords": [
          "soccer",
          "soccer ball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "⚾",
        "keywords": [
          "baseball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🥎",
        "keywords": [
          "softball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏀",
        "keywords": [
          "basketball",
          "basketball and hoop",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏐",
        "keywords": [
          "volleyball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏈",
        "keywords": [
          "football",
          "american football",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏉",
        "keywords": [
          "rugby football",
          "rugby",
          "football",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🎾",
        "keywords": [
          "tennis",
          "tennis racquet and ball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🥏",
        "keywords": [
          "flying disc",
          "flying",
          "disc",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🎳",
        "keywords": [
          "bowling",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏏",
        "keywords": [
          "cricket bat and ball",
          "cricket",
          "bat",
          "and",
          "ball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏑",
        "keywords": [
          "field hockey stick and ball",
          "field",
          "hockey",
          "stick",
          "and",
          "ball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏒",
        "keywords": [
          "ice hockey stick and puck",
          "ice",
          "hockey",
          "stick",
          "and",
          "puck",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🥍",
        "keywords": [
          "lacrosse",
          "lacrosse stick and ball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏓",
        "keywords": [
          "table tennis paddle and ball",
          "table",
          "tennis",
          "paddle",
          "and",
          "ball",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🏸",
        "keywords": [
          "badminton racquet and shuttlecock",
          "badminton",
          "racquet",
          "and",
          "shuttlecock",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🥊",
        "keywords": [
          "boxing glove",
          "boxing",
          "glove",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🥋",
        "keywords": [
          "martial arts uniform",
          "martial",
          "arts",
          "uniform",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🥅",
        "keywords": [
          "goal net",
          "goal",
          "net",
          "activities",
          "sport"
        ]
      },
      {
        "value": "⛳",
        "keywords": [
          "golf",
          "flag in hole",
          "activities",
          "sport"
        ]
      },
      {
        "value": "⛸️",
        "keywords": [
          "ice skate",
          "ice",
          "skate",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🎣",
        "keywords": [
          "fishing pole and fish",
          "fishing",
          "pole",
          "and",
          "fish",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🤿",
        "keywords": [
          "diving mask",
          "diving",
          "mask",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🎽",
        "keywords": [
          "running shirt with sash",
          "running",
          "shirt",
          "with",
          "sash",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🎿",
        "keywords": [
          "ski",
          "ski and ski boot",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🛷",
        "keywords": [
          "sled",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🥌",
        "keywords": [
          "curling stone",
          "curling",
          "stone",
          "activities",
          "sport"
        ]
      },
      {
        "value": "🎯",
        "keywords": [
          "dart",
          "direct hit",
          "activities",
          "game"
        ]
      },
      {
        "value": "🪀",
        "keywords": [
          "yo-yo",
          "activities",
          "game"
        ]
      },
      {
        "value": "🪁",
        "keywords": [
          "kite",
          "activities",
          "game"
        ]
      },
      {
        "value": "🔫",
        "keywords": [
          "gun",
          "pistol",
          "activities",
          "game"
        ]
      },
      {
        "value": "🎱",
        "keywords": [
          "8ball",
          "billiards",
          "activities",
          "game"
        ]
      },
      {
        "value": "🔮",
        "keywords": [
          "crystal ball",
          "crystal",
          "ball",
          "activities",
          "game"
        ]
      },
      {
        "value": "🪄",
        "keywords": [
          "magic wand",
          "magic",
          "wand",
          "activities",
          "game"
        ]
      },
      {
        "value": "🎮",
        "keywords": [
          "video game",
          "video",
          "game",
          "activities"
        ]
      },
      {
        "value": "🕹️",
        "keywords": [
          "joystick",
          "activities",
          "game"
        ]
      },
      {
        "value": "🎰",
        "keywords": [
          "slot machine",
          "slot",
          "machine",
          "activities",
          "game"
        ]
      },
      {
        "value": "🎲",
        "keywords": [
          "game die",
          "game",
          "die",
          "activities"
        ]
      },
      {
        "value": "🧩",
        "keywords": [
          "jigsaw",
          "jigsaw puzzle piece",
          "activities",
          "game"
        ]
      },
      {
        "value": "🧸",
        "keywords": [
          "teddy bear",
          "teddy",
          "bear",
          "activities",
          "game"
        ]
      },
      {
        "value": "🪅",
        "keywords": [
          "pinata",
          "activities",
          "game"
        ]
      },
      {
        "value": "🪩",
        "keywords": [
          "mirror ball",
          "mirror",
          "ball",
          "activities",
          "game"
        ]
      },
      {
        "value": "🪆",
        "keywords": [
          "nesting dolls",
          "nesting",
          "dolls",
          "activities",
          "game"
        ]
      },
      {
        "value": "♠️",
        "keywords": [
          "spades",
          "black spade suit",
          "activities",
          "game"
        ]
      },
      {
        "value": "♥️",
        "keywords": [
          "hearts",
          "black heart suit",
          "activities",
          "game"
        ]
      },
      {
        "value": "♦️",
        "keywords": [
          "diamonds",
          "black diamond suit",
          "activities",
          "game"
        ]
      },
      {
        "value": "♣️",
        "keywords": [
          "clubs",
          "black club suit",
          "activities",
          "game"
        ]
      },
      {
        "value": "♟️",
        "keywords": [
          "chess pawn",
          "chess",
          "pawn",
          "activities",
          "game"
        ]
      },
      {
        "value": "🃏",
        "keywords": [
          "black joker",
          "black",
          "joker",
          "playing card black joker",
          "activities",
          "game"
        ]
      },
      {
        "value": "🀄",
        "keywords": [
          "mahjong",
          "mahjong tile red dragon",
          "activities",
          "game"
        ]
      },
      {
        "value": "🎴",
        "keywords": [
          "flower playing cards",
          "flower",
          "playing",
          "cards",
          "activities",
          "game"
        ]
      },
      {
        "value": "🎭",
        "keywords": [
          "performing arts",
          "performing",
          "arts",
          "activities",
          "arts crafts"
        ]
      },
      {
        "value": "🖼️",
        "keywords": [
          "frame with picture",
          "frame",
          "with",
          "picture",
          "framed picture",
          "activities",
          "arts crafts"
        ]
      },
      {
        "value": "🎨",
        "keywords": [
          "art",
          "artist palette",
          "activities",
          "arts crafts"
        ]
      },
      {
        "value": "🧵",
        "keywords": [
          "thread",
          "spool of thread",
          "activities",
          "arts crafts"
        ]
      },
      {
        "value": "🪡",
        "keywords": [
          "sewing needle",
          "sewing",
          "needle",
          "activities",
          "arts crafts"
        ]
      },
      {
        "value": "🧶",
        "keywords": [
          "yarn",
          "ball of yarn",
          "activities",
          "arts crafts"
        ]
      },
      {
        "value": "🪢",
        "keywords": [
          "knot",
          "activities",
          "arts crafts"
        ]
      }
    ]
  },
  {
    "id": "travel",
    "label": "Lugares",
    "nativeLabel": "Viagens e lugares",
    "emojis": [
      {
        "value": "🌍",
        "keywords": [
          "earth africa",
          "earth",
          "africa",
          "earth globe europe-africa",
          "travel places",
          "place-map"
        ]
      },
      {
        "value": "🌎",
        "keywords": [
          "earth americas",
          "earth",
          "americas",
          "earth globe americas",
          "travel places",
          "place-map"
        ]
      },
      {
        "value": "🌏",
        "keywords": [
          "earth asia",
          "earth",
          "asia",
          "earth globe asia-australia",
          "travel places",
          "place-map"
        ]
      },
      {
        "value": "🌐",
        "keywords": [
          "globe with meridians",
          "globe",
          "with",
          "meridians",
          "travel places",
          "place-map"
        ]
      },
      {
        "value": "🗺️",
        "keywords": [
          "world map",
          "world",
          "map",
          "travel places",
          "place-map"
        ]
      },
      {
        "value": "🗾",
        "keywords": [
          "japan",
          "silhouette of japan",
          "travel places",
          "place-map"
        ]
      },
      {
        "value": "🧭",
        "keywords": [
          "compass",
          "travel places",
          "place-map"
        ]
      },
      {
        "value": "🏔️",
        "keywords": [
          "snow capped mountain",
          "snow",
          "capped",
          "mountain",
          "snow-capped mountain",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "⛰️",
        "keywords": [
          "mountain",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "🌋",
        "keywords": [
          "volcano",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "🗻",
        "keywords": [
          "mount fuji",
          "mount",
          "fuji",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "🏕️",
        "keywords": [
          "camping",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "🏖️",
        "keywords": [
          "beach with umbrella",
          "beach",
          "with",
          "umbrella",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "🏜️",
        "keywords": [
          "desert",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "🏝️",
        "keywords": [
          "desert island",
          "desert",
          "island",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "🏞️",
        "keywords": [
          "national park",
          "national",
          "park",
          "travel places",
          "place-geographic"
        ]
      },
      {
        "value": "🏟️",
        "keywords": [
          "stadium",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏛️",
        "keywords": [
          "classical building",
          "classical",
          "building",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏗️",
        "keywords": [
          "building construction",
          "building",
          "construction",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🧱",
        "keywords": [
          "bricks",
          "brick",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🪨",
        "keywords": [
          "rock",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🪵",
        "keywords": [
          "wood",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🛖",
        "keywords": [
          "hut",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏘️",
        "keywords": [
          "house buildings",
          "house",
          "buildings",
          "houses",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏚️",
        "keywords": [
          "derelict house building",
          "derelict",
          "house",
          "building",
          "derelict house",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏠",
        "keywords": [
          "house",
          "house building",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏡",
        "keywords": [
          "house with garden",
          "house",
          "with",
          "garden",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏢",
        "keywords": [
          "office",
          "office building",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏣",
        "keywords": [
          "post office",
          "post",
          "office",
          "japanese post office",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏤",
        "keywords": [
          "european post office",
          "european",
          "post",
          "office",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏥",
        "keywords": [
          "hospital",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏦",
        "keywords": [
          "bank",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏨",
        "keywords": [
          "hotel",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏩",
        "keywords": [
          "love hotel",
          "love",
          "hotel",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏪",
        "keywords": [
          "convenience store",
          "convenience",
          "store",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏫",
        "keywords": [
          "school",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏬",
        "keywords": [
          "department store",
          "department",
          "store",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏭",
        "keywords": [
          "factory",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏯",
        "keywords": [
          "japanese castle",
          "japanese",
          "castle",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🏰",
        "keywords": [
          "european castle",
          "european",
          "castle",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "💒",
        "keywords": [
          "wedding",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🗼",
        "keywords": [
          "tokyo tower",
          "tokyo",
          "tower",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "🗽",
        "keywords": [
          "statue of liberty",
          "statue",
          "of",
          "liberty",
          "travel places",
          "place-building"
        ]
      },
      {
        "value": "⛪",
        "keywords": [
          "church",
          "travel places",
          "place-religious"
        ]
      },
      {
        "value": "🕌",
        "keywords": [
          "mosque",
          "travel places",
          "place-religious"
        ]
      },
      {
        "value": "🛕",
        "keywords": [
          "hindu temple",
          "hindu",
          "temple",
          "travel places",
          "place-religious"
        ]
      },
      {
        "value": "🕍",
        "keywords": [
          "synagogue",
          "travel places",
          "place-religious"
        ]
      },
      {
        "value": "⛩️",
        "keywords": [
          "shinto shrine",
          "shinto",
          "shrine",
          "travel places",
          "place-religious"
        ]
      },
      {
        "value": "🕋",
        "keywords": [
          "kaaba",
          "travel places",
          "place-religious"
        ]
      },
      {
        "value": "⛲",
        "keywords": [
          "fountain",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "⛺",
        "keywords": [
          "tent",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🌁",
        "keywords": [
          "foggy",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🌃",
        "keywords": [
          "night with stars",
          "night",
          "with",
          "stars",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🏙️",
        "keywords": [
          "cityscape",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🌄",
        "keywords": [
          "sunrise over mountains",
          "sunrise",
          "over",
          "mountains",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🌅",
        "keywords": [
          "sunrise",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🌆",
        "keywords": [
          "city sunset",
          "city",
          "sunset",
          "cityscape at dusk",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🌇",
        "keywords": [
          "city sunrise",
          "city",
          "sunrise",
          "sunset over buildings",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🌉",
        "keywords": [
          "bridge at night",
          "bridge",
          "at",
          "night",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "♨️",
        "keywords": [
          "hotsprings",
          "hot springs",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🎠",
        "keywords": [
          "carousel horse",
          "carousel",
          "horse",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🛝",
        "keywords": [
          "playground slide",
          "playground",
          "slide",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🎡",
        "keywords": [
          "ferris wheel",
          "ferris",
          "wheel",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🎢",
        "keywords": [
          "roller coaster",
          "roller",
          "coaster",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "💈",
        "keywords": [
          "barber",
          "barber pole",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🎪",
        "keywords": [
          "circus tent",
          "circus",
          "tent",
          "travel places",
          "place-other"
        ]
      },
      {
        "value": "🚂",
        "keywords": [
          "steam locomotive",
          "steam",
          "locomotive",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚃",
        "keywords": [
          "railway car",
          "railway",
          "car",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚄",
        "keywords": [
          "bullettrain side",
          "bullettrain",
          "side",
          "high-speed train",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚅",
        "keywords": [
          "bullettrain front",
          "bullettrain",
          "front",
          "high-speed train with bullet nose",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚆",
        "keywords": [
          "train2",
          "train",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚇",
        "keywords": [
          "metro",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚈",
        "keywords": [
          "light rail",
          "light",
          "rail",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚉",
        "keywords": [
          "station",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚊",
        "keywords": [
          "tram",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚝",
        "keywords": [
          "monorail",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚞",
        "keywords": [
          "mountain railway",
          "mountain",
          "railway",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚋",
        "keywords": [
          "train",
          "tram car",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚌",
        "keywords": [
          "bus",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚍",
        "keywords": [
          "oncoming bus",
          "oncoming",
          "bus",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚎",
        "keywords": [
          "trolleybus",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚐",
        "keywords": [
          "minibus",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚑",
        "keywords": [
          "ambulance",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚒",
        "keywords": [
          "fire engine",
          "fire",
          "engine",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚓",
        "keywords": [
          "police car",
          "police",
          "car",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚔",
        "keywords": [
          "oncoming police car",
          "oncoming",
          "police",
          "car",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚕",
        "keywords": [
          "taxi",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚖",
        "keywords": [
          "oncoming taxi",
          "oncoming",
          "taxi",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚗",
        "keywords": [
          "car",
          "red car",
          "red",
          "automobile",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚘",
        "keywords": [
          "oncoming automobile",
          "oncoming",
          "automobile",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚙",
        "keywords": [
          "blue car",
          "blue",
          "car",
          "recreational vehicle",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛻",
        "keywords": [
          "pickup truck",
          "pickup",
          "truck",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚚",
        "keywords": [
          "truck",
          "delivery truck",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚛",
        "keywords": [
          "articulated lorry",
          "articulated",
          "lorry",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚜",
        "keywords": [
          "tractor",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🏎️",
        "keywords": [
          "racing car",
          "racing",
          "car",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🏍️",
        "keywords": [
          "racing motorcycle",
          "racing",
          "motorcycle",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛵",
        "keywords": [
          "motor scooter",
          "motor",
          "scooter",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🦽",
        "keywords": [
          "manual wheelchair",
          "manual",
          "wheelchair",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🦼",
        "keywords": [
          "motorized wheelchair",
          "motorized",
          "wheelchair",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛺",
        "keywords": [
          "auto rickshaw",
          "auto",
          "rickshaw",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚲",
        "keywords": [
          "bike",
          "bicycle",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛴",
        "keywords": [
          "scooter",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛹",
        "keywords": [
          "skateboard",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛼",
        "keywords": [
          "roller skate",
          "roller",
          "skate",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚏",
        "keywords": [
          "busstop",
          "bus stop",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛣️",
        "keywords": [
          "motorway",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛤️",
        "keywords": [
          "railway track",
          "railway",
          "track",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛢️",
        "keywords": [
          "oil drum",
          "oil",
          "drum",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "⛽",
        "keywords": [
          "fuelpump",
          "fuel pump",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛞",
        "keywords": [
          "wheel",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚨",
        "keywords": [
          "rotating light",
          "rotating",
          "light",
          "police cars revolving light",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚥",
        "keywords": [
          "traffic light",
          "traffic",
          "light",
          "horizontal traffic light",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚦",
        "keywords": [
          "vertical traffic light",
          "vertical",
          "traffic",
          "light",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🛑",
        "keywords": [
          "octagonal sign",
          "octagonal",
          "sign",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "🚧",
        "keywords": [
          "construction",
          "construction sign",
          "travel places",
          "transport-ground"
        ]
      },
      {
        "value": "⚓",
        "keywords": [
          "anchor",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "🛟",
        "keywords": [
          "ring buoy",
          "ring",
          "buoy",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "⛵",
        "keywords": [
          "boat",
          "sailboat",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "🛶",
        "keywords": [
          "canoe",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "🚤",
        "keywords": [
          "speedboat",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "🛳️",
        "keywords": [
          "passenger ship",
          "passenger",
          "ship",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "⛴️",
        "keywords": [
          "ferry",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "🛥️",
        "keywords": [
          "motor boat",
          "motor",
          "boat",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "🚢",
        "keywords": [
          "ship",
          "travel places",
          "transport-water"
        ]
      },
      {
        "value": "✈️",
        "keywords": [
          "airplane",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🛩️",
        "keywords": [
          "small airplane",
          "small",
          "airplane",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🛫",
        "keywords": [
          "airplane departure",
          "airplane",
          "departure",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🛬",
        "keywords": [
          "airplane arriving",
          "airplane",
          "arriving",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🪂",
        "keywords": [
          "parachute",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "💺",
        "keywords": [
          "seat",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🚁",
        "keywords": [
          "helicopter",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🚟",
        "keywords": [
          "suspension railway",
          "suspension",
          "railway",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🚠",
        "keywords": [
          "mountain cableway",
          "mountain",
          "cableway",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🚡",
        "keywords": [
          "aerial tramway",
          "aerial",
          "tramway",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🛰️",
        "keywords": [
          "satellite",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🚀",
        "keywords": [
          "rocket",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🛸",
        "keywords": [
          "flying saucer",
          "flying",
          "saucer",
          "travel places",
          "transport-air"
        ]
      },
      {
        "value": "🛎️",
        "keywords": [
          "bellhop bell",
          "bellhop",
          "bell",
          "travel places",
          "hotel"
        ]
      },
      {
        "value": "🧳",
        "keywords": [
          "luggage",
          "travel places",
          "hotel"
        ]
      },
      {
        "value": "⌛",
        "keywords": [
          "hourglass",
          "travel places",
          "time"
        ]
      },
      {
        "value": "⏳",
        "keywords": [
          "hourglass flowing sand",
          "hourglass",
          "flowing",
          "sand",
          "hourglass with flowing sand",
          "travel places",
          "time"
        ]
      },
      {
        "value": "⌚",
        "keywords": [
          "watch",
          "travel places",
          "time"
        ]
      },
      {
        "value": "⏰",
        "keywords": [
          "alarm clock",
          "alarm",
          "clock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "⏱️",
        "keywords": [
          "stopwatch",
          "travel places",
          "time"
        ]
      },
      {
        "value": "⏲️",
        "keywords": [
          "timer clock",
          "timer",
          "clock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕰️",
        "keywords": [
          "mantelpiece clock",
          "mantelpiece",
          "clock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕛",
        "keywords": [
          "clock12",
          "clock face twelve oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕧",
        "keywords": [
          "clock1230",
          "clock face twelve-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕐",
        "keywords": [
          "clock1",
          "clock face one oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕜",
        "keywords": [
          "clock130",
          "clock face one-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕑",
        "keywords": [
          "clock2",
          "clock face two oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕝",
        "keywords": [
          "clock230",
          "clock face two-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕒",
        "keywords": [
          "clock3",
          "clock face three oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕞",
        "keywords": [
          "clock330",
          "clock face three-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕓",
        "keywords": [
          "clock4",
          "clock face four oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕟",
        "keywords": [
          "clock430",
          "clock face four-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕔",
        "keywords": [
          "clock5",
          "clock face five oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕠",
        "keywords": [
          "clock530",
          "clock face five-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕕",
        "keywords": [
          "clock6",
          "clock face six oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕡",
        "keywords": [
          "clock630",
          "clock face six-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕖",
        "keywords": [
          "clock7",
          "clock face seven oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕢",
        "keywords": [
          "clock730",
          "clock face seven-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕗",
        "keywords": [
          "clock8",
          "clock face eight oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕣",
        "keywords": [
          "clock830",
          "clock face eight-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕘",
        "keywords": [
          "clock9",
          "clock face nine oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕤",
        "keywords": [
          "clock930",
          "clock face nine-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕙",
        "keywords": [
          "clock10",
          "clock face ten oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕥",
        "keywords": [
          "clock1030",
          "clock face ten-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕚",
        "keywords": [
          "clock11",
          "clock face eleven oclock",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🕦",
        "keywords": [
          "clock1130",
          "clock face eleven-thirty",
          "travel places",
          "time"
        ]
      },
      {
        "value": "🌑",
        "keywords": [
          "new moon",
          "new",
          "moon",
          "new moon symbol",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌒",
        "keywords": [
          "waxing crescent moon",
          "waxing",
          "crescent",
          "moon",
          "waxing crescent moon symbol",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌓",
        "keywords": [
          "first quarter moon",
          "first",
          "quarter",
          "moon",
          "first quarter moon symbol",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌔",
        "keywords": [
          "moon",
          "waxing gibbous moon",
          "waxing",
          "gibbous",
          "waxing gibbous moon symbol",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌕",
        "keywords": [
          "full moon",
          "full",
          "moon",
          "full moon symbol",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌖",
        "keywords": [
          "waning gibbous moon",
          "waning",
          "gibbous",
          "moon",
          "waning gibbous moon symbol",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌗",
        "keywords": [
          "last quarter moon",
          "last",
          "quarter",
          "moon",
          "last quarter moon symbol",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌘",
        "keywords": [
          "waning crescent moon",
          "waning",
          "crescent",
          "moon",
          "waning crescent moon symbol",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌙",
        "keywords": [
          "crescent moon",
          "crescent",
          "moon",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌚",
        "keywords": [
          "new moon with face",
          "new",
          "moon",
          "with",
          "face",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌛",
        "keywords": [
          "first quarter moon with face",
          "first",
          "quarter",
          "moon",
          "with",
          "face",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌜",
        "keywords": [
          "last quarter moon with face",
          "last",
          "quarter",
          "moon",
          "with",
          "face",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌡️",
        "keywords": [
          "thermometer",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "☀️",
        "keywords": [
          "sunny",
          "black sun with rays",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌝",
        "keywords": [
          "full moon with face",
          "full",
          "moon",
          "with",
          "face",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌞",
        "keywords": [
          "sun with face",
          "sun",
          "with",
          "face",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🪐",
        "keywords": [
          "ringed planet",
          "ringed",
          "planet",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "⭐",
        "keywords": [
          "star",
          "white medium star",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌟",
        "keywords": [
          "star2",
          "glowing star",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌠",
        "keywords": [
          "stars",
          "shooting star",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌌",
        "keywords": [
          "milky way",
          "milky",
          "way",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "☁️",
        "keywords": [
          "cloud",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "⛅",
        "keywords": [
          "partly sunny",
          "partly",
          "sunny",
          "sun behind cloud",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "⛈️",
        "keywords": [
          "thunder cloud and rain",
          "thunder",
          "cloud",
          "and",
          "rain",
          "cloud with lightning and rain",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌤️",
        "keywords": [
          "mostly sunny",
          "mostly",
          "sunny",
          "sun small cloud",
          "sun",
          "small",
          "cloud",
          "sun behind small cloud",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌥️",
        "keywords": [
          "barely sunny",
          "barely",
          "sunny",
          "sun behind cloud",
          "sun",
          "behind",
          "cloud",
          "sun behind large cloud",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌦️",
        "keywords": [
          "partly sunny rain",
          "partly",
          "sunny",
          "rain",
          "sun behind rain cloud",
          "sun",
          "behind",
          "cloud",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌧️",
        "keywords": [
          "rain cloud",
          "rain",
          "cloud",
          "cloud with rain",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌨️",
        "keywords": [
          "snow cloud",
          "snow",
          "cloud",
          "cloud with snow",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌩️",
        "keywords": [
          "lightning",
          "lightning cloud",
          "cloud",
          "cloud with lightning",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌪️",
        "keywords": [
          "tornado",
          "tornado cloud",
          "cloud",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌫️",
        "keywords": [
          "fog",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌬️",
        "keywords": [
          "wind blowing face",
          "wind",
          "blowing",
          "face",
          "wind face",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌀",
        "keywords": [
          "cyclone",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌈",
        "keywords": [
          "rainbow",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌂",
        "keywords": [
          "closed umbrella",
          "closed",
          "umbrella",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "☂️",
        "keywords": [
          "umbrella",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "☔",
        "keywords": [
          "umbrella with rain drops",
          "umbrella",
          "with",
          "rain",
          "drops",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "⛱️",
        "keywords": [
          "umbrella on ground",
          "umbrella",
          "on",
          "ground",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "⚡",
        "keywords": [
          "zap",
          "high voltage sign",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "❄️",
        "keywords": [
          "snowflake",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "☃️",
        "keywords": [
          "snowman",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "⛄",
        "keywords": [
          "snowman without snow",
          "snowman",
          "without",
          "snow",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "☄️",
        "keywords": [
          "comet",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🔥",
        "keywords": [
          "fire",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "💧",
        "keywords": [
          "droplet",
          "travel places",
          "sky weather"
        ]
      },
      {
        "value": "🌊",
        "keywords": [
          "ocean",
          "water wave",
          "travel places",
          "sky weather"
        ]
      }
    ]
  },
  {
    "id": "objects",
    "label": "Objetos",
    "nativeLabel": "Objetos",
    "emojis": [
      {
        "value": "👓",
        "keywords": [
          "eyeglasses",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🕶️",
        "keywords": [
          "dark sunglasses",
          "dark",
          "sunglasses",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🥽",
        "keywords": [
          "goggles",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🥼",
        "keywords": [
          "lab coat",
          "lab",
          "coat",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🦺",
        "keywords": [
          "safety vest",
          "safety",
          "vest",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👔",
        "keywords": [
          "necktie",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👕",
        "keywords": [
          "shirt",
          "tshirt",
          "t-shirt",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👖",
        "keywords": [
          "jeans",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🧣",
        "keywords": [
          "scarf",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🧤",
        "keywords": [
          "gloves",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🧥",
        "keywords": [
          "coat",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🧦",
        "keywords": [
          "socks",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👗",
        "keywords": [
          "dress",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👘",
        "keywords": [
          "kimono",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🥻",
        "keywords": [
          "sari",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🩱",
        "keywords": [
          "one-piece swimsuit",
          "one-piece",
          "swimsuit",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🩲",
        "keywords": [
          "briefs",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🩳",
        "keywords": [
          "shorts",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👙",
        "keywords": [
          "bikini",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👚",
        "keywords": [
          "womans clothes",
          "womans",
          "clothes",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🪭",
        "keywords": [
          "folding hand fan",
          "folding",
          "hand",
          "fan",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👛",
        "keywords": [
          "purse",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👜",
        "keywords": [
          "handbag",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👝",
        "keywords": [
          "pouch",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🛍️",
        "keywords": [
          "shopping bags",
          "shopping",
          "bags",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🎒",
        "keywords": [
          "school satchel",
          "school",
          "satchel",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🩴",
        "keywords": [
          "thong sandal",
          "thong",
          "sandal",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👞",
        "keywords": [
          "mans shoe",
          "mans",
          "shoe",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👟",
        "keywords": [
          "athletic shoe",
          "athletic",
          "shoe",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🥾",
        "keywords": [
          "hiking boot",
          "hiking",
          "boot",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🥿",
        "keywords": [
          "womans flat shoe",
          "womans",
          "flat",
          "shoe",
          "flat shoe",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👠",
        "keywords": [
          "high heel",
          "high",
          "heel",
          "high-heeled shoe",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👡",
        "keywords": [
          "sandal",
          "womans sandal",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🩰",
        "keywords": [
          "ballet shoes",
          "ballet",
          "shoes",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👢",
        "keywords": [
          "boot",
          "womans boots",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🪮",
        "keywords": [
          "hair pick",
          "hair",
          "pick",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👑",
        "keywords": [
          "crown",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "👒",
        "keywords": [
          "womans hat",
          "womans",
          "hat",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🎩",
        "keywords": [
          "tophat",
          "top hat",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🎓",
        "keywords": [
          "mortar board",
          "mortar",
          "board",
          "graduation cap",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🧢",
        "keywords": [
          "billed cap",
          "billed",
          "cap",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🪖",
        "keywords": [
          "military helmet",
          "military",
          "helmet",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "⛑️",
        "keywords": [
          "helmet with white cross",
          "helmet",
          "with",
          "white",
          "cross",
          "rescue worker’s helmet",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "📿",
        "keywords": [
          "prayer beads",
          "prayer",
          "beads",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "💄",
        "keywords": [
          "lipstick",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "💍",
        "keywords": [
          "ring",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "💎",
        "keywords": [
          "gem",
          "gem stone",
          "objects",
          "clothing"
        ]
      },
      {
        "value": "🔇",
        "keywords": [
          "mute",
          "speaker with cancellation stroke",
          "objects",
          "sound"
        ]
      },
      {
        "value": "🔈",
        "keywords": [
          "speaker",
          "objects",
          "sound"
        ]
      },
      {
        "value": "🔉",
        "keywords": [
          "sound",
          "speaker with one sound wave",
          "objects"
        ]
      },
      {
        "value": "🔊",
        "keywords": [
          "loud sound",
          "loud",
          "sound",
          "speaker with three sound waves",
          "objects"
        ]
      },
      {
        "value": "📢",
        "keywords": [
          "loudspeaker",
          "public address loudspeaker",
          "objects",
          "sound"
        ]
      },
      {
        "value": "📣",
        "keywords": [
          "mega",
          "cheering megaphone",
          "objects",
          "sound"
        ]
      },
      {
        "value": "📯",
        "keywords": [
          "postal horn",
          "postal",
          "horn",
          "objects",
          "sound"
        ]
      },
      {
        "value": "🔔",
        "keywords": [
          "bell",
          "objects",
          "sound"
        ]
      },
      {
        "value": "🔕",
        "keywords": [
          "no bell",
          "no",
          "bell",
          "bell with cancellation stroke",
          "objects",
          "sound"
        ]
      },
      {
        "value": "🎼",
        "keywords": [
          "musical score",
          "musical",
          "score",
          "objects",
          "music"
        ]
      },
      {
        "value": "🎵",
        "keywords": [
          "musical note",
          "musical",
          "note",
          "objects",
          "music"
        ]
      },
      {
        "value": "🎶",
        "keywords": [
          "notes",
          "multiple musical notes",
          "objects",
          "music"
        ]
      },
      {
        "value": "🎙️",
        "keywords": [
          "studio microphone",
          "studio",
          "microphone",
          "objects",
          "music"
        ]
      },
      {
        "value": "🎚️",
        "keywords": [
          "level slider",
          "level",
          "slider",
          "objects",
          "music"
        ]
      },
      {
        "value": "🎛️",
        "keywords": [
          "control knobs",
          "control",
          "knobs",
          "objects",
          "music"
        ]
      },
      {
        "value": "🎤",
        "keywords": [
          "microphone",
          "objects",
          "music"
        ]
      },
      {
        "value": "🎧",
        "keywords": [
          "headphones",
          "headphone",
          "objects",
          "music"
        ]
      },
      {
        "value": "📻",
        "keywords": [
          "radio",
          "objects",
          "music"
        ]
      },
      {
        "value": "🎷",
        "keywords": [
          "saxophone",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🪗",
        "keywords": [
          "accordion",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🎸",
        "keywords": [
          "guitar",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🎹",
        "keywords": [
          "musical keyboard",
          "musical",
          "keyboard",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🎺",
        "keywords": [
          "trumpet",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🎻",
        "keywords": [
          "violin",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🪕",
        "keywords": [
          "banjo",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🥁",
        "keywords": [
          "drum with drumsticks",
          "drum",
          "with",
          "drumsticks",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🪘",
        "keywords": [
          "long drum",
          "long",
          "drum",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🪇",
        "keywords": [
          "maracas",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🪈",
        "keywords": [
          "flute",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "🪉",
        "keywords": [
          "harp",
          "objects",
          "musical-instrument"
        ]
      },
      {
        "value": "📱",
        "keywords": [
          "iphone",
          "mobile phone",
          "objects",
          "phone"
        ]
      },
      {
        "value": "📲",
        "keywords": [
          "calling",
          "mobile phone with rightwards arrow at left",
          "objects",
          "phone"
        ]
      },
      {
        "value": "☎️",
        "keywords": [
          "phone",
          "telephone",
          "black telephone",
          "objects"
        ]
      },
      {
        "value": "📞",
        "keywords": [
          "telephone receiver",
          "telephone",
          "receiver",
          "objects",
          "phone"
        ]
      },
      {
        "value": "📟",
        "keywords": [
          "pager",
          "objects",
          "phone"
        ]
      },
      {
        "value": "📠",
        "keywords": [
          "fax",
          "fax machine",
          "objects",
          "phone"
        ]
      },
      {
        "value": "🔋",
        "keywords": [
          "battery",
          "objects",
          "computer"
        ]
      },
      {
        "value": "🪫",
        "keywords": [
          "low battery",
          "low",
          "battery",
          "objects",
          "computer"
        ]
      },
      {
        "value": "🔌",
        "keywords": [
          "electric plug",
          "electric",
          "plug",
          "objects",
          "computer"
        ]
      },
      {
        "value": "💻",
        "keywords": [
          "computer",
          "personal computer",
          "objects"
        ]
      },
      {
        "value": "🖥️",
        "keywords": [
          "desktop computer",
          "desktop",
          "computer",
          "objects"
        ]
      },
      {
        "value": "🖨️",
        "keywords": [
          "printer",
          "objects",
          "computer"
        ]
      },
      {
        "value": "⌨️",
        "keywords": [
          "keyboard",
          "objects",
          "computer"
        ]
      },
      {
        "value": "🖱️",
        "keywords": [
          "three button mouse",
          "three",
          "button",
          "mouse",
          "computer mouse",
          "objects",
          "computer"
        ]
      },
      {
        "value": "🖲️",
        "keywords": [
          "trackball",
          "objects",
          "computer"
        ]
      },
      {
        "value": "💽",
        "keywords": [
          "minidisc",
          "objects",
          "computer"
        ]
      },
      {
        "value": "💾",
        "keywords": [
          "floppy disk",
          "floppy",
          "disk",
          "objects",
          "computer"
        ]
      },
      {
        "value": "💿",
        "keywords": [
          "cd",
          "optical disc",
          "objects",
          "computer"
        ]
      },
      {
        "value": "📀",
        "keywords": [
          "dvd",
          "objects",
          "computer"
        ]
      },
      {
        "value": "🧮",
        "keywords": [
          "abacus",
          "objects",
          "computer"
        ]
      },
      {
        "value": "🎥",
        "keywords": [
          "movie camera",
          "movie",
          "camera",
          "objects",
          "light video"
        ]
      },
      {
        "value": "🎞️",
        "keywords": [
          "film frames",
          "film",
          "frames",
          "objects",
          "light video"
        ]
      },
      {
        "value": "📽️",
        "keywords": [
          "film projector",
          "film",
          "projector",
          "objects",
          "light video"
        ]
      },
      {
        "value": "🎬",
        "keywords": [
          "clapper",
          "clapper board",
          "objects",
          "light video"
        ]
      },
      {
        "value": "📺",
        "keywords": [
          "tv",
          "television",
          "objects",
          "light video"
        ]
      },
      {
        "value": "📷",
        "keywords": [
          "camera",
          "objects",
          "light video"
        ]
      },
      {
        "value": "📸",
        "keywords": [
          "camera with flash",
          "camera",
          "with",
          "flash",
          "objects",
          "light video"
        ]
      },
      {
        "value": "📹",
        "keywords": [
          "video camera",
          "video",
          "camera",
          "objects",
          "light video"
        ]
      },
      {
        "value": "📼",
        "keywords": [
          "vhs",
          "videocassette",
          "objects",
          "light video"
        ]
      },
      {
        "value": "🔍",
        "keywords": [
          "mag",
          "left-pointing magnifying glass",
          "objects",
          "light video"
        ]
      },
      {
        "value": "🔎",
        "keywords": [
          "mag right",
          "mag",
          "right",
          "right-pointing magnifying glass",
          "objects",
          "light video"
        ]
      },
      {
        "value": "🕯️",
        "keywords": [
          "candle",
          "objects",
          "light video"
        ]
      },
      {
        "value": "💡",
        "keywords": [
          "bulb",
          "electric light bulb",
          "objects",
          "light video"
        ]
      },
      {
        "value": "🔦",
        "keywords": [
          "flashlight",
          "electric torch",
          "objects",
          "light video"
        ]
      },
      {
        "value": "🏮",
        "keywords": [
          "izakaya lantern",
          "izakaya",
          "lantern",
          "objects",
          "light video"
        ]
      },
      {
        "value": "🪔",
        "keywords": [
          "diya lamp",
          "diya",
          "lamp",
          "objects",
          "light video"
        ]
      },
      {
        "value": "📔",
        "keywords": [
          "notebook with decorative cover",
          "notebook",
          "with",
          "decorative",
          "cover",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📕",
        "keywords": [
          "closed book",
          "closed",
          "book",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📖",
        "keywords": [
          "book",
          "open book",
          "open",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📗",
        "keywords": [
          "green book",
          "green",
          "book",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📘",
        "keywords": [
          "blue book",
          "blue",
          "book",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📙",
        "keywords": [
          "orange book",
          "orange",
          "book",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📚",
        "keywords": [
          "books",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📓",
        "keywords": [
          "notebook",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📒",
        "keywords": [
          "ledger",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📃",
        "keywords": [
          "page with curl",
          "page",
          "with",
          "curl",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📜",
        "keywords": [
          "scroll",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📄",
        "keywords": [
          "page facing up",
          "page",
          "facing",
          "up",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📰",
        "keywords": [
          "newspaper",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "🗞️",
        "keywords": [
          "rolled up newspaper",
          "rolled",
          "up",
          "newspaper",
          "rolled-up newspaper",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "📑",
        "keywords": [
          "bookmark tabs",
          "bookmark",
          "tabs",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "🔖",
        "keywords": [
          "bookmark",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "🏷️",
        "keywords": [
          "label",
          "objects",
          "book-paper"
        ]
      },
      {
        "value": "💰",
        "keywords": [
          "moneybag",
          "money bag",
          "objects",
          "money"
        ]
      },
      {
        "value": "🪙",
        "keywords": [
          "coin",
          "objects",
          "money"
        ]
      },
      {
        "value": "💴",
        "keywords": [
          "yen",
          "banknote with yen sign",
          "objects",
          "money"
        ]
      },
      {
        "value": "💵",
        "keywords": [
          "dollar",
          "banknote with dollar sign",
          "objects",
          "money"
        ]
      },
      {
        "value": "💶",
        "keywords": [
          "euro",
          "banknote with euro sign",
          "objects",
          "money"
        ]
      },
      {
        "value": "💷",
        "keywords": [
          "pound",
          "banknote with pound sign",
          "objects",
          "money"
        ]
      },
      {
        "value": "💸",
        "keywords": [
          "money with wings",
          "money",
          "with",
          "wings",
          "objects"
        ]
      },
      {
        "value": "💳",
        "keywords": [
          "credit card",
          "credit",
          "card",
          "objects",
          "money"
        ]
      },
      {
        "value": "🧾",
        "keywords": [
          "receipt",
          "objects",
          "money"
        ]
      },
      {
        "value": "💹",
        "keywords": [
          "chart",
          "chart with upwards trend and yen sign",
          "objects",
          "money"
        ]
      },
      {
        "value": "✉️",
        "keywords": [
          "email",
          "envelope",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📧",
        "keywords": [
          "e-mail",
          "e-mail symbol",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📨",
        "keywords": [
          "incoming envelope",
          "incoming",
          "envelope",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📩",
        "keywords": [
          "envelope with arrow",
          "envelope",
          "with",
          "arrow",
          "envelope with downwards arrow above",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📤",
        "keywords": [
          "outbox tray",
          "outbox",
          "tray",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📥",
        "keywords": [
          "inbox tray",
          "inbox",
          "tray",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📦",
        "keywords": [
          "package",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📫",
        "keywords": [
          "mailbox",
          "closed mailbox with raised flag",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📪",
        "keywords": [
          "mailbox closed",
          "mailbox",
          "closed",
          "closed mailbox with lowered flag",
          "objects",
          "mail"
        ]
      },
      {
        "value": "📬",
        "keywords": [
          "mailbox with mail",
          "mailbox",
          "with",
          "mail",
          "open mailbox with raised flag",
          "objects"
        ]
      },
      {
        "value": "📭",
        "keywords": [
          "mailbox with no mail",
          "mailbox",
          "with",
          "no",
          "mail",
          "open mailbox with lowered flag",
          "objects"
        ]
      },
      {
        "value": "📮",
        "keywords": [
          "postbox",
          "objects",
          "mail"
        ]
      },
      {
        "value": "🗳️",
        "keywords": [
          "ballot box with ballot",
          "ballot",
          "box",
          "with",
          "objects",
          "mail"
        ]
      },
      {
        "value": "✏️",
        "keywords": [
          "pencil2",
          "pencil",
          "objects",
          "writing"
        ]
      },
      {
        "value": "✒️",
        "keywords": [
          "black nib",
          "black",
          "nib",
          "objects",
          "writing"
        ]
      },
      {
        "value": "🖋️",
        "keywords": [
          "lower left fountain pen",
          "lower",
          "left",
          "fountain",
          "pen",
          "fountain pen",
          "objects",
          "writing"
        ]
      },
      {
        "value": "🖊️",
        "keywords": [
          "lower left ballpoint pen",
          "lower",
          "left",
          "ballpoint",
          "pen",
          "objects",
          "writing"
        ]
      },
      {
        "value": "🖌️",
        "keywords": [
          "lower left paintbrush",
          "lower",
          "left",
          "paintbrush",
          "objects",
          "writing"
        ]
      },
      {
        "value": "🖍️",
        "keywords": [
          "lower left crayon",
          "lower",
          "left",
          "crayon",
          "objects",
          "writing"
        ]
      },
      {
        "value": "📝",
        "keywords": [
          "memo",
          "pencil",
          "objects",
          "writing"
        ]
      },
      {
        "value": "💼",
        "keywords": [
          "briefcase",
          "objects",
          "office"
        ]
      },
      {
        "value": "📁",
        "keywords": [
          "file folder",
          "file",
          "folder",
          "objects",
          "office"
        ]
      },
      {
        "value": "📂",
        "keywords": [
          "open file folder",
          "open",
          "file",
          "folder",
          "objects",
          "office"
        ]
      },
      {
        "value": "🗂️",
        "keywords": [
          "card index dividers",
          "card",
          "index",
          "dividers",
          "objects",
          "office"
        ]
      },
      {
        "value": "📅",
        "keywords": [
          "date",
          "calendar",
          "objects",
          "office"
        ]
      },
      {
        "value": "📆",
        "keywords": [
          "calendar",
          "tear-off calendar",
          "objects",
          "office"
        ]
      },
      {
        "value": "🗒️",
        "keywords": [
          "spiral note pad",
          "spiral",
          "note",
          "pad",
          "spiral notepad",
          "objects",
          "office"
        ]
      },
      {
        "value": "🗓️",
        "keywords": [
          "spiral calendar pad",
          "spiral",
          "calendar",
          "pad",
          "spiral calendar",
          "objects",
          "office"
        ]
      },
      {
        "value": "📇",
        "keywords": [
          "card index",
          "card",
          "index",
          "objects",
          "office"
        ]
      },
      {
        "value": "📈",
        "keywords": [
          "chart with upwards trend",
          "chart",
          "with",
          "upwards",
          "trend",
          "objects",
          "office"
        ]
      },
      {
        "value": "📉",
        "keywords": [
          "chart with downwards trend",
          "chart",
          "with",
          "downwards",
          "trend",
          "objects",
          "office"
        ]
      },
      {
        "value": "📊",
        "keywords": [
          "bar chart",
          "bar",
          "chart",
          "objects",
          "office"
        ]
      },
      {
        "value": "📋",
        "keywords": [
          "clipboard",
          "objects",
          "office"
        ]
      },
      {
        "value": "📌",
        "keywords": [
          "pushpin",
          "objects",
          "office"
        ]
      },
      {
        "value": "📍",
        "keywords": [
          "round pushpin",
          "round",
          "pushpin",
          "objects",
          "office"
        ]
      },
      {
        "value": "📎",
        "keywords": [
          "paperclip",
          "objects",
          "office"
        ]
      },
      {
        "value": "🖇️",
        "keywords": [
          "linked paperclips",
          "linked",
          "paperclips",
          "objects",
          "office"
        ]
      },
      {
        "value": "📏",
        "keywords": [
          "straight ruler",
          "straight",
          "ruler",
          "objects",
          "office"
        ]
      },
      {
        "value": "📐",
        "keywords": [
          "triangular ruler",
          "triangular",
          "ruler",
          "objects",
          "office"
        ]
      },
      {
        "value": "✂️",
        "keywords": [
          "scissors",
          "black scissors",
          "objects",
          "office"
        ]
      },
      {
        "value": "🗃️",
        "keywords": [
          "card file box",
          "card",
          "file",
          "box",
          "objects",
          "office"
        ]
      },
      {
        "value": "🗄️",
        "keywords": [
          "file cabinet",
          "file",
          "cabinet",
          "objects",
          "office"
        ]
      },
      {
        "value": "🗑️",
        "keywords": [
          "wastebasket",
          "objects",
          "office"
        ]
      },
      {
        "value": "🔒",
        "keywords": [
          "lock",
          "objects"
        ]
      },
      {
        "value": "🔓",
        "keywords": [
          "unlock",
          "open lock",
          "objects",
          "lock"
        ]
      },
      {
        "value": "🔏",
        "keywords": [
          "lock with ink pen",
          "lock",
          "with",
          "ink",
          "pen",
          "objects"
        ]
      },
      {
        "value": "🔐",
        "keywords": [
          "closed lock with key",
          "closed",
          "lock",
          "with",
          "key",
          "objects"
        ]
      },
      {
        "value": "🔑",
        "keywords": [
          "key",
          "objects",
          "lock"
        ]
      },
      {
        "value": "🗝️",
        "keywords": [
          "old key",
          "old",
          "key",
          "objects",
          "lock"
        ]
      },
      {
        "value": "🔨",
        "keywords": [
          "hammer",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🪓",
        "keywords": [
          "axe",
          "objects",
          "tool"
        ]
      },
      {
        "value": "⛏️",
        "keywords": [
          "pick",
          "objects",
          "tool"
        ]
      },
      {
        "value": "⚒️",
        "keywords": [
          "hammer and pick",
          "hammer",
          "and",
          "pick",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🛠️",
        "keywords": [
          "hammer and wrench",
          "hammer",
          "and",
          "wrench",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🗡️",
        "keywords": [
          "dagger knife",
          "dagger",
          "knife",
          "objects",
          "tool"
        ]
      },
      {
        "value": "⚔️",
        "keywords": [
          "crossed swords",
          "crossed",
          "swords",
          "objects",
          "tool"
        ]
      },
      {
        "value": "💣",
        "keywords": [
          "bomb",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🪃",
        "keywords": [
          "boomerang",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🏹",
        "keywords": [
          "bow and arrow",
          "bow",
          "and",
          "arrow",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🛡️",
        "keywords": [
          "shield",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🪚",
        "keywords": [
          "carpentry saw",
          "carpentry",
          "saw",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🔧",
        "keywords": [
          "wrench",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🪛",
        "keywords": [
          "screwdriver",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🔩",
        "keywords": [
          "nut and bolt",
          "nut",
          "and",
          "bolt",
          "objects",
          "tool"
        ]
      },
      {
        "value": "⚙️",
        "keywords": [
          "gear",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🗜️",
        "keywords": [
          "compression",
          "clamp",
          "objects",
          "tool"
        ]
      },
      {
        "value": "⚖️",
        "keywords": [
          "scales",
          "balance scale",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🦯",
        "keywords": [
          "probing cane",
          "probing",
          "cane",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🔗",
        "keywords": [
          "link",
          "link symbol",
          "objects",
          "tool"
        ]
      },
      {
        "value": "⛓️‍💥",
        "keywords": [
          "broken chain",
          "broken",
          "chain",
          "objects",
          "tool"
        ]
      },
      {
        "value": "⛓️",
        "keywords": [
          "chains",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🪝",
        "keywords": [
          "hook",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🧰",
        "keywords": [
          "toolbox",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🧲",
        "keywords": [
          "magnet",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🪜",
        "keywords": [
          "ladder",
          "objects",
          "tool"
        ]
      },
      {
        "value": "🪏",
        "keywords": [
          "shovel",
          "objects",
          "tool"
        ]
      },
      {
        "value": "⚗️",
        "keywords": [
          "alembic",
          "objects",
          "science"
        ]
      },
      {
        "value": "🧪",
        "keywords": [
          "test tube",
          "test",
          "tube",
          "objects",
          "science"
        ]
      },
      {
        "value": "🧫",
        "keywords": [
          "petri dish",
          "petri",
          "dish",
          "objects",
          "science"
        ]
      },
      {
        "value": "🧬",
        "keywords": [
          "dna",
          "dna double helix",
          "objects",
          "science"
        ]
      },
      {
        "value": "🔬",
        "keywords": [
          "microscope",
          "objects",
          "science"
        ]
      },
      {
        "value": "🔭",
        "keywords": [
          "telescope",
          "objects",
          "science"
        ]
      },
      {
        "value": "📡",
        "keywords": [
          "satellite antenna",
          "satellite",
          "antenna",
          "objects",
          "science"
        ]
      },
      {
        "value": "💉",
        "keywords": [
          "syringe",
          "objects",
          "medical"
        ]
      },
      {
        "value": "🩸",
        "keywords": [
          "drop of blood",
          "drop",
          "of",
          "blood",
          "objects",
          "medical"
        ]
      },
      {
        "value": "💊",
        "keywords": [
          "pill",
          "objects",
          "medical"
        ]
      },
      {
        "value": "🩹",
        "keywords": [
          "adhesive bandage",
          "adhesive",
          "bandage",
          "objects",
          "medical"
        ]
      },
      {
        "value": "🩼",
        "keywords": [
          "crutch",
          "objects",
          "medical"
        ]
      },
      {
        "value": "🩺",
        "keywords": [
          "stethoscope",
          "objects",
          "medical"
        ]
      },
      {
        "value": "🩻",
        "keywords": [
          "x-ray",
          "objects",
          "medical"
        ]
      },
      {
        "value": "🚪",
        "keywords": [
          "door",
          "objects",
          "household"
        ]
      },
      {
        "value": "🛗",
        "keywords": [
          "elevator",
          "objects",
          "household"
        ]
      },
      {
        "value": "🪞",
        "keywords": [
          "mirror",
          "objects",
          "household"
        ]
      },
      {
        "value": "🪟",
        "keywords": [
          "window",
          "objects",
          "household"
        ]
      },
      {
        "value": "🛏️",
        "keywords": [
          "bed",
          "objects",
          "household"
        ]
      },
      {
        "value": "🛋️",
        "keywords": [
          "couch and lamp",
          "couch",
          "and",
          "lamp",
          "objects",
          "household"
        ]
      },
      {
        "value": "🪑",
        "keywords": [
          "chair",
          "objects",
          "household"
        ]
      },
      {
        "value": "🚽",
        "keywords": [
          "toilet",
          "objects",
          "household"
        ]
      },
      {
        "value": "🪠",
        "keywords": [
          "plunger",
          "objects",
          "household"
        ]
      },
      {
        "value": "🚿",
        "keywords": [
          "shower",
          "objects",
          "household"
        ]
      },
      {
        "value": "🛁",
        "keywords": [
          "bathtub",
          "objects",
          "household"
        ]
      },
      {
        "value": "🪤",
        "keywords": [
          "mouse trap",
          "mouse",
          "trap",
          "objects",
          "household"
        ]
      },
      {
        "value": "🪒",
        "keywords": [
          "razor",
          "objects",
          "household"
        ]
      },
      {
        "value": "🧴",
        "keywords": [
          "lotion bottle",
          "lotion",
          "bottle",
          "objects",
          "household"
        ]
      },
      {
        "value": "🧷",
        "keywords": [
          "safety pin",
          "safety",
          "pin",
          "objects",
          "household"
        ]
      },
      {
        "value": "🧹",
        "keywords": [
          "broom",
          "objects",
          "household"
        ]
      },
      {
        "value": "🧺",
        "keywords": [
          "basket",
          "objects",
          "household"
        ]
      },
      {
        "value": "🧻",
        "keywords": [
          "roll of paper",
          "roll",
          "of",
          "paper",
          "objects",
          "household"
        ]
      },
      {
        "value": "🪣",
        "keywords": [
          "bucket",
          "objects",
          "household"
        ]
      },
      {
        "value": "🧼",
        "keywords": [
          "soap",
          "bar of soap",
          "objects",
          "household"
        ]
      },
      {
        "value": "🫧",
        "keywords": [
          "bubbles",
          "objects",
          "household"
        ]
      },
      {
        "value": "🪥",
        "keywords": [
          "toothbrush",
          "objects",
          "household"
        ]
      },
      {
        "value": "🧽",
        "keywords": [
          "sponge",
          "objects",
          "household"
        ]
      },
      {
        "value": "🧯",
        "keywords": [
          "fire extinguisher",
          "fire",
          "extinguisher",
          "objects",
          "household"
        ]
      },
      {
        "value": "🛒",
        "keywords": [
          "shopping trolley",
          "shopping",
          "trolley",
          "objects",
          "household"
        ]
      },
      {
        "value": "🚬",
        "keywords": [
          "smoking",
          "smoking symbol",
          "objects",
          "other-object"
        ]
      },
      {
        "value": "⚰️",
        "keywords": [
          "coffin",
          "objects",
          "other-object"
        ]
      },
      {
        "value": "🪦",
        "keywords": [
          "headstone",
          "objects",
          "other-object"
        ]
      },
      {
        "value": "⚱️",
        "keywords": [
          "funeral urn",
          "funeral",
          "urn",
          "objects",
          "other-object"
        ]
      },
      {
        "value": "🧿",
        "keywords": [
          "nazar amulet",
          "nazar",
          "amulet",
          "objects",
          "other-object"
        ]
      },
      {
        "value": "🪬",
        "keywords": [
          "hamsa",
          "objects",
          "other-object"
        ]
      },
      {
        "value": "🗿",
        "keywords": [
          "moyai",
          "objects",
          "other-object"
        ]
      },
      {
        "value": "🪧",
        "keywords": [
          "placard",
          "objects",
          "other-object"
        ]
      },
      {
        "value": "🪪",
        "keywords": [
          "identification card",
          "identification",
          "card",
          "objects",
          "other-object"
        ]
      }
    ]
  },
  {
    "id": "symbols",
    "label": "Simbolos",
    "nativeLabel": "Simbolos",
    "emojis": [
      {
        "value": "🏧",
        "keywords": [
          "atm",
          "automated teller machine",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🚮",
        "keywords": [
          "put litter in its place",
          "put",
          "litter",
          "in",
          "its",
          "place",
          "put litter in its place symbol",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🚰",
        "keywords": [
          "potable water",
          "potable",
          "water",
          "potable water symbol",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "♿",
        "keywords": [
          "wheelchair",
          "wheelchair symbol",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🚹",
        "keywords": [
          "mens",
          "mens symbol",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🚺",
        "keywords": [
          "womens",
          "womens symbol",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🚻",
        "keywords": [
          "restroom",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🚼",
        "keywords": [
          "baby symbol",
          "baby",
          "symbol",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🚾",
        "keywords": [
          "wc",
          "water closet",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🛂",
        "keywords": [
          "passport control",
          "passport",
          "control",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🛃",
        "keywords": [
          "customs",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🛄",
        "keywords": [
          "baggage claim",
          "baggage",
          "claim",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "🛅",
        "keywords": [
          "left luggage",
          "left",
          "luggage",
          "symbols",
          "transport-sign"
        ]
      },
      {
        "value": "⚠️",
        "keywords": [
          "warning",
          "warning sign",
          "symbols"
        ]
      },
      {
        "value": "🚸",
        "keywords": [
          "children crossing",
          "children",
          "crossing",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "⛔",
        "keywords": [
          "no entry",
          "no",
          "entry",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "🚫",
        "keywords": [
          "no entry sign",
          "no",
          "entry",
          "sign",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "🚳",
        "keywords": [
          "no bicycles",
          "no",
          "bicycles",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "🚭",
        "keywords": [
          "no smoking",
          "no",
          "smoking",
          "no smoking symbol",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "🚯",
        "keywords": [
          "do not litter",
          "do",
          "not",
          "litter",
          "do not litter symbol",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "🚱",
        "keywords": [
          "non-potable water",
          "non-potable",
          "water",
          "non-potable water symbol",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "🚷",
        "keywords": [
          "no pedestrians",
          "no",
          "pedestrians",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "📵",
        "keywords": [
          "no mobile phones",
          "no",
          "mobile",
          "phones",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "🔞",
        "keywords": [
          "underage",
          "no one under eighteen symbol",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "☢️",
        "keywords": [
          "radioactive sign",
          "radioactive",
          "sign",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "☣️",
        "keywords": [
          "biohazard sign",
          "biohazard",
          "sign",
          "symbols",
          "warning"
        ]
      },
      {
        "value": "⬆️",
        "keywords": [
          "arrow up",
          "arrow",
          "up",
          "upwards black arrow",
          "symbols"
        ]
      },
      {
        "value": "↗️",
        "keywords": [
          "arrow upper right",
          "arrow",
          "upper",
          "right",
          "north east arrow",
          "symbols"
        ]
      },
      {
        "value": "➡️",
        "keywords": [
          "arrow right",
          "arrow",
          "right",
          "black rightwards arrow",
          "symbols"
        ]
      },
      {
        "value": "↘️",
        "keywords": [
          "arrow lower right",
          "arrow",
          "lower",
          "right",
          "south east arrow",
          "symbols"
        ]
      },
      {
        "value": "⬇️",
        "keywords": [
          "arrow down",
          "arrow",
          "down",
          "downwards black arrow",
          "symbols"
        ]
      },
      {
        "value": "↙️",
        "keywords": [
          "arrow lower left",
          "arrow",
          "lower",
          "left",
          "south west arrow",
          "symbols"
        ]
      },
      {
        "value": "⬅️",
        "keywords": [
          "arrow left",
          "arrow",
          "left",
          "leftwards black arrow",
          "symbols"
        ]
      },
      {
        "value": "↖️",
        "keywords": [
          "arrow upper left",
          "arrow",
          "upper",
          "left",
          "north west arrow",
          "symbols"
        ]
      },
      {
        "value": "↕️",
        "keywords": [
          "arrow up down",
          "arrow",
          "up",
          "down",
          "up down arrow",
          "symbols"
        ]
      },
      {
        "value": "↔️",
        "keywords": [
          "left right arrow",
          "left",
          "right",
          "arrow",
          "symbols"
        ]
      },
      {
        "value": "↩️",
        "keywords": [
          "leftwards arrow with hook",
          "leftwards",
          "arrow",
          "with",
          "hook",
          "symbols"
        ]
      },
      {
        "value": "↪️",
        "keywords": [
          "arrow right hook",
          "arrow",
          "right",
          "hook",
          "rightwards arrow with hook",
          "symbols"
        ]
      },
      {
        "value": "⤴️",
        "keywords": [
          "arrow heading up",
          "arrow",
          "heading",
          "up",
          "arrow pointing rightwards then curving upwards",
          "symbols"
        ]
      },
      {
        "value": "⤵️",
        "keywords": [
          "arrow heading down",
          "arrow",
          "heading",
          "down",
          "arrow pointing rightwards then curving downwards",
          "symbols"
        ]
      },
      {
        "value": "🔃",
        "keywords": [
          "arrows clockwise",
          "arrows",
          "clockwise",
          "clockwise downwards and upwards open circle arrows",
          "symbols",
          "arrow"
        ]
      },
      {
        "value": "🔄",
        "keywords": [
          "arrows counterclockwise",
          "arrows",
          "counterclockwise",
          "anticlockwise downwards and upwards open circle arrows",
          "symbols",
          "arrow"
        ]
      },
      {
        "value": "🔙",
        "keywords": [
          "back",
          "back with leftwards arrow above",
          "symbols",
          "arrow"
        ]
      },
      {
        "value": "🔚",
        "keywords": [
          "end",
          "end with leftwards arrow above",
          "symbols",
          "arrow"
        ]
      },
      {
        "value": "🔛",
        "keywords": [
          "on",
          "on with exclamation mark with left right arrow above",
          "symbols",
          "arrow"
        ]
      },
      {
        "value": "🔜",
        "keywords": [
          "soon",
          "soon with rightwards arrow above",
          "symbols",
          "arrow"
        ]
      },
      {
        "value": "🔝",
        "keywords": [
          "top",
          "top with upwards arrow above",
          "symbols",
          "arrow"
        ]
      },
      {
        "value": "🛐",
        "keywords": [
          "place of worship",
          "place",
          "of",
          "worship",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "⚛️",
        "keywords": [
          "atom symbol",
          "atom",
          "symbol",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "🕉️",
        "keywords": [
          "om symbol",
          "om",
          "symbol",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "✡️",
        "keywords": [
          "star of david",
          "star",
          "of",
          "david",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "☸️",
        "keywords": [
          "wheel of dharma",
          "wheel",
          "of",
          "dharma",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "☯️",
        "keywords": [
          "yin yang",
          "yin",
          "yang",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "✝️",
        "keywords": [
          "latin cross",
          "latin",
          "cross",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "☦️",
        "keywords": [
          "orthodox cross",
          "orthodox",
          "cross",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "☪️",
        "keywords": [
          "star and crescent",
          "star",
          "and",
          "crescent",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "☮️",
        "keywords": [
          "peace symbol",
          "peace",
          "symbol",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "🕎",
        "keywords": [
          "menorah with nine branches",
          "menorah",
          "with",
          "nine",
          "branches",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "🔯",
        "keywords": [
          "six pointed star",
          "six",
          "pointed",
          "star",
          "six pointed star with middle dot",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "🪯",
        "keywords": [
          "khanda",
          "symbols",
          "religion"
        ]
      },
      {
        "value": "♈",
        "keywords": [
          "aries",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♉",
        "keywords": [
          "taurus",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♊",
        "keywords": [
          "gemini",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♋",
        "keywords": [
          "cancer",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♌",
        "keywords": [
          "leo",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♍",
        "keywords": [
          "virgo",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♎",
        "keywords": [
          "libra",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♏",
        "keywords": [
          "scorpius",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♐",
        "keywords": [
          "sagittarius",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♑",
        "keywords": [
          "capricorn",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♒",
        "keywords": [
          "aquarius",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "♓",
        "keywords": [
          "pisces",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "⛎",
        "keywords": [
          "ophiuchus",
          "symbols",
          "zodiac"
        ]
      },
      {
        "value": "🔀",
        "keywords": [
          "twisted rightwards arrows",
          "twisted",
          "rightwards",
          "arrows",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "🔁",
        "keywords": [
          "repeat",
          "clockwise rightwards and leftwards open circle arrows",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "🔂",
        "keywords": [
          "repeat one",
          "repeat",
          "one",
          "clockwise rightwards and leftwards open circle arrows with circled one overlay",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "▶️",
        "keywords": [
          "arrow forward",
          "arrow",
          "forward",
          "black right-pointing triangle",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏩",
        "keywords": [
          "fast forward",
          "fast",
          "forward",
          "black right-pointing double triangle",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏭️",
        "keywords": [
          "black right pointing double triangle with vertical bar",
          "black",
          "right",
          "pointing",
          "double",
          "triangle",
          "with",
          "vertical",
          "bar",
          "next track button",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏯️",
        "keywords": [
          "black right pointing triangle with double vertical bar",
          "black",
          "right",
          "pointing",
          "triangle",
          "with",
          "double",
          "vertical",
          "bar",
          "play or pause button",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "◀️",
        "keywords": [
          "arrow backward",
          "arrow",
          "backward",
          "black left-pointing triangle",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏪",
        "keywords": [
          "rewind",
          "black left-pointing double triangle",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏮️",
        "keywords": [
          "black left pointing double triangle with vertical bar",
          "black",
          "left",
          "pointing",
          "double",
          "triangle",
          "with",
          "vertical",
          "bar",
          "last track button",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "🔼",
        "keywords": [
          "arrow up small",
          "arrow",
          "up",
          "small",
          "up-pointing small red triangle",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏫",
        "keywords": [
          "arrow double up",
          "arrow",
          "double",
          "up",
          "black up-pointing double triangle",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "🔽",
        "keywords": [
          "arrow down small",
          "arrow",
          "down",
          "small",
          "down-pointing small red triangle",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏬",
        "keywords": [
          "arrow double down",
          "arrow",
          "double",
          "down",
          "black down-pointing double triangle",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏸️",
        "keywords": [
          "double vertical bar",
          "double",
          "vertical",
          "bar",
          "pause button",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏹️",
        "keywords": [
          "black square for stop",
          "black",
          "square",
          "for",
          "stop",
          "stop button",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏺️",
        "keywords": [
          "black circle for record",
          "black",
          "circle",
          "for",
          "record",
          "record button",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "⏏️",
        "keywords": [
          "eject",
          "eject button",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "🎦",
        "keywords": [
          "cinema",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "🔅",
        "keywords": [
          "low brightness",
          "low",
          "brightness",
          "low brightness symbol",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "🔆",
        "keywords": [
          "high brightness",
          "high",
          "brightness",
          "high brightness symbol",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "📶",
        "keywords": [
          "signal strength",
          "signal",
          "strength",
          "antenna with bars",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "🛜",
        "keywords": [
          "wireless",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "📳",
        "keywords": [
          "vibration mode",
          "vibration",
          "mode",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "📴",
        "keywords": [
          "mobile phone off",
          "mobile",
          "phone",
          "off",
          "symbols",
          "av-symbol"
        ]
      },
      {
        "value": "♀️",
        "keywords": [
          "female sign",
          "female",
          "sign",
          "symbols",
          "gender"
        ]
      },
      {
        "value": "♂️",
        "keywords": [
          "male sign",
          "male",
          "sign",
          "symbols",
          "gender"
        ]
      },
      {
        "value": "⚧️",
        "keywords": [
          "transgender symbol",
          "transgender",
          "symbol",
          "symbols",
          "gender"
        ]
      },
      {
        "value": "✖️",
        "keywords": [
          "heavy multiplication x",
          "heavy",
          "multiplication",
          "x",
          "symbols",
          "math"
        ]
      },
      {
        "value": "➕",
        "keywords": [
          "heavy plus sign",
          "heavy",
          "plus",
          "sign",
          "symbols",
          "math"
        ]
      },
      {
        "value": "➖",
        "keywords": [
          "heavy minus sign",
          "heavy",
          "minus",
          "sign",
          "symbols",
          "math"
        ]
      },
      {
        "value": "➗",
        "keywords": [
          "heavy division sign",
          "heavy",
          "division",
          "sign",
          "symbols",
          "math"
        ]
      },
      {
        "value": "🟰",
        "keywords": [
          "heavy equals sign",
          "heavy",
          "equals",
          "sign",
          "symbols",
          "math"
        ]
      },
      {
        "value": "♾️",
        "keywords": [
          "infinity",
          "symbols",
          "math"
        ]
      },
      {
        "value": "‼️",
        "keywords": [
          "bangbang",
          "double exclamation mark",
          "symbols",
          "punctuation"
        ]
      },
      {
        "value": "⁉️",
        "keywords": [
          "interrobang",
          "exclamation question mark",
          "symbols",
          "punctuation"
        ]
      },
      {
        "value": "❓",
        "keywords": [
          "question",
          "black question mark ornament",
          "symbols",
          "punctuation"
        ]
      },
      {
        "value": "❔",
        "keywords": [
          "grey question",
          "grey",
          "question",
          "white question mark ornament",
          "symbols",
          "punctuation"
        ]
      },
      {
        "value": "❕",
        "keywords": [
          "grey exclamation",
          "grey",
          "exclamation",
          "white exclamation mark ornament",
          "symbols",
          "punctuation"
        ]
      },
      {
        "value": "❗",
        "keywords": [
          "exclamation",
          "heavy exclamation mark",
          "heavy",
          "mark",
          "heavy exclamation mark symbol",
          "symbols",
          "punctuation"
        ]
      },
      {
        "value": "〰️",
        "keywords": [
          "wavy dash",
          "wavy",
          "dash",
          "symbols",
          "punctuation"
        ]
      },
      {
        "value": "💱",
        "keywords": [
          "currency exchange",
          "currency",
          "exchange",
          "symbols"
        ]
      },
      {
        "value": "💲",
        "keywords": [
          "heavy dollar sign",
          "heavy",
          "dollar",
          "sign",
          "symbols",
          "currency"
        ]
      },
      {
        "value": "⚕️",
        "keywords": [
          "medical symbol",
          "medical",
          "symbol",
          "staff of aesculapius",
          "staff",
          "of",
          "aesculapius",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "♻️",
        "keywords": [
          "recycle",
          "black universal recycling symbol",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "⚜️",
        "keywords": [
          "fleur de lis",
          "fleur",
          "de",
          "lis",
          "fleur-de-lis",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "🔱",
        "keywords": [
          "trident",
          "trident emblem",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "📛",
        "keywords": [
          "name badge",
          "name",
          "badge",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "🔰",
        "keywords": [
          "beginner",
          "japanese symbol for beginner",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "⭕",
        "keywords": [
          "o",
          "heavy large circle",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "✅",
        "keywords": [
          "white check mark",
          "white",
          "check",
          "mark",
          "white heavy check mark",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "☑️",
        "keywords": [
          "ballot box with check",
          "ballot",
          "box",
          "with",
          "check",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "✔️",
        "keywords": [
          "heavy check mark",
          "heavy",
          "check",
          "mark",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "❌",
        "keywords": [
          "x",
          "cross mark",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "❎",
        "keywords": [
          "negative squared cross mark",
          "negative",
          "squared",
          "cross",
          "mark",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "➰",
        "keywords": [
          "curly loop",
          "curly",
          "loop",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "➿",
        "keywords": [
          "loop",
          "double curly loop",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "〽️",
        "keywords": [
          "part alternation mark",
          "part",
          "alternation",
          "mark",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "✳️",
        "keywords": [
          "eight spoked asterisk",
          "eight",
          "spoked",
          "asterisk",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "✴️",
        "keywords": [
          "eight pointed black star",
          "eight",
          "pointed",
          "black",
          "star",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "❇️",
        "keywords": [
          "sparkle",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "©️",
        "keywords": [
          "copyright",
          "copyright sign",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "®️",
        "keywords": [
          "registered",
          "registered sign",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "™️",
        "keywords": [
          "tm",
          "trade mark sign",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "🫟",
        "keywords": [
          "splatter",
          "symbols",
          "other-symbol"
        ]
      },
      {
        "value": "#️⃣",
        "keywords": [
          "hash",
          "hash key",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "*️⃣",
        "keywords": [
          "keycap star",
          "keycap",
          "star",
          "keycap *",
          "symbols"
        ]
      },
      {
        "value": "0️⃣",
        "keywords": [
          "zero",
          "keycap 0",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "1️⃣",
        "keywords": [
          "one",
          "keycap 1",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "2️⃣",
        "keywords": [
          "two",
          "keycap 2",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "3️⃣",
        "keywords": [
          "three",
          "keycap 3",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "4️⃣",
        "keywords": [
          "four",
          "keycap 4",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "5️⃣",
        "keywords": [
          "five",
          "keycap 5",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "6️⃣",
        "keywords": [
          "six",
          "keycap 6",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "7️⃣",
        "keywords": [
          "seven",
          "keycap 7",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "8️⃣",
        "keywords": [
          "eight",
          "keycap 8",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "9️⃣",
        "keywords": [
          "nine",
          "keycap 9",
          "symbols",
          "keycap"
        ]
      },
      {
        "value": "🔟",
        "keywords": [
          "keycap ten",
          "keycap",
          "ten",
          "symbols"
        ]
      },
      {
        "value": "🔠",
        "keywords": [
          "capital abcd",
          "capital",
          "abcd",
          "input symbol for latin capital letters",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🔡",
        "keywords": [
          "abcd",
          "input symbol for latin small letters",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🔢",
        "keywords": [
          "1234",
          "input symbol for numbers",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🔣",
        "keywords": [
          "symbols",
          "input symbol for symbols",
          "alphanum"
        ]
      },
      {
        "value": "🔤",
        "keywords": [
          "abc",
          "input symbol for latin letters",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🅰️",
        "keywords": [
          "a",
          "negative squared latin capital letter a",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆎",
        "keywords": [
          "ab",
          "negative squared ab",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🅱️",
        "keywords": [
          "b",
          "negative squared latin capital letter b",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆑",
        "keywords": [
          "cl",
          "squared cl",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆒",
        "keywords": [
          "cool",
          "squared cool",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆓",
        "keywords": [
          "free",
          "squared free",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "ℹ️",
        "keywords": [
          "information source",
          "information",
          "source",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆔",
        "keywords": [
          "id",
          "squared id",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "Ⓜ️",
        "keywords": [
          "m",
          "circled latin capital letter m",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆕",
        "keywords": [
          "new",
          "squared new",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆖",
        "keywords": [
          "ng",
          "squared ng",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🅾️",
        "keywords": [
          "o2",
          "negative squared latin capital letter o",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆗",
        "keywords": [
          "ok",
          "squared ok",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🅿️",
        "keywords": [
          "parking",
          "negative squared latin capital letter p",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆘",
        "keywords": [
          "sos",
          "squared sos",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆙",
        "keywords": [
          "up",
          "squared up with exclamation mark",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🆚",
        "keywords": [
          "vs",
          "squared vs",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈁",
        "keywords": [
          "koko",
          "squared katakana koko",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈂️",
        "keywords": [
          "sa",
          "squared katakana sa",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈷️",
        "keywords": [
          "u6708",
          "squared cjk unified ideograph-6708",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈶",
        "keywords": [
          "u6709",
          "squared cjk unified ideograph-6709",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈯",
        "keywords": [
          "u6307",
          "squared cjk unified ideograph-6307",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🉐",
        "keywords": [
          "ideograph advantage",
          "ideograph",
          "advantage",
          "circled ideograph advantage",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈹",
        "keywords": [
          "u5272",
          "squared cjk unified ideograph-5272",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈚",
        "keywords": [
          "u7121",
          "squared cjk unified ideograph-7121",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈲",
        "keywords": [
          "u7981",
          "squared cjk unified ideograph-7981",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🉑",
        "keywords": [
          "accept",
          "circled ideograph accept",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈸",
        "keywords": [
          "u7533",
          "squared cjk unified ideograph-7533",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈴",
        "keywords": [
          "u5408",
          "squared cjk unified ideograph-5408",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈳",
        "keywords": [
          "u7a7a",
          "squared cjk unified ideograph-7a7a",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "㊗️",
        "keywords": [
          "congratulations",
          "circled ideograph congratulation",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "㊙️",
        "keywords": [
          "secret",
          "circled ideograph secret",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈺",
        "keywords": [
          "u55b6",
          "squared cjk unified ideograph-55b6",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🈵",
        "keywords": [
          "u6e80",
          "squared cjk unified ideograph-6e80",
          "symbols",
          "alphanum"
        ]
      },
      {
        "value": "🔴",
        "keywords": [
          "red circle",
          "red",
          "circle",
          "large red circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟠",
        "keywords": [
          "large orange circle",
          "large",
          "orange",
          "circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟡",
        "keywords": [
          "large yellow circle",
          "large",
          "yellow",
          "circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟢",
        "keywords": [
          "large green circle",
          "large",
          "green",
          "circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔵",
        "keywords": [
          "large blue circle",
          "large",
          "blue",
          "circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟣",
        "keywords": [
          "large purple circle",
          "large",
          "purple",
          "circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟤",
        "keywords": [
          "large brown circle",
          "large",
          "brown",
          "circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "⚫",
        "keywords": [
          "black circle",
          "black",
          "circle",
          "medium black circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "⚪",
        "keywords": [
          "white circle",
          "white",
          "circle",
          "medium white circle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟥",
        "keywords": [
          "large red square",
          "large",
          "red",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟧",
        "keywords": [
          "large orange square",
          "large",
          "orange",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟨",
        "keywords": [
          "large yellow square",
          "large",
          "yellow",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟩",
        "keywords": [
          "large green square",
          "large",
          "green",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟦",
        "keywords": [
          "large blue square",
          "large",
          "blue",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟪",
        "keywords": [
          "large purple square",
          "large",
          "purple",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🟫",
        "keywords": [
          "large brown square",
          "large",
          "brown",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "⬛",
        "keywords": [
          "black large square",
          "black",
          "large",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "⬜",
        "keywords": [
          "white large square",
          "white",
          "large",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "◼️",
        "keywords": [
          "black medium square",
          "black",
          "medium",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "◻️",
        "keywords": [
          "white medium square",
          "white",
          "medium",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "◾",
        "keywords": [
          "black medium small square",
          "black",
          "medium",
          "small",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "◽",
        "keywords": [
          "white medium small square",
          "white",
          "medium",
          "small",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "▪️",
        "keywords": [
          "black small square",
          "black",
          "small",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "▫️",
        "keywords": [
          "white small square",
          "white",
          "small",
          "square",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔶",
        "keywords": [
          "large orange diamond",
          "large",
          "orange",
          "diamond",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔷",
        "keywords": [
          "large blue diamond",
          "large",
          "blue",
          "diamond",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔸",
        "keywords": [
          "small orange diamond",
          "small",
          "orange",
          "diamond",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔹",
        "keywords": [
          "small blue diamond",
          "small",
          "blue",
          "diamond",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔺",
        "keywords": [
          "small red triangle",
          "small",
          "red",
          "triangle",
          "up-pointing red triangle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔻",
        "keywords": [
          "small red triangle down",
          "small",
          "red",
          "triangle",
          "down",
          "down-pointing red triangle",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "💠",
        "keywords": [
          "diamond shape with a dot inside",
          "diamond",
          "shape",
          "with",
          "a",
          "dot",
          "inside",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔘",
        "keywords": [
          "radio button",
          "radio",
          "button",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔳",
        "keywords": [
          "white square button",
          "white",
          "square",
          "button",
          "symbols",
          "geometric"
        ]
      },
      {
        "value": "🔲",
        "keywords": [
          "black square button",
          "black",
          "square",
          "button",
          "symbols",
          "geometric"
        ]
      }
    ]
  },
  {
    "id": "flags",
    "label": "Bandeiras",
    "nativeLabel": "Bandeiras",
    "emojis": [
      {
        "value": "🏁",
        "keywords": [
          "checkered flag",
          "checkered",
          "flag",
          "chequered flag",
          "flags"
        ]
      },
      {
        "value": "🚩",
        "keywords": [
          "triangular flag on post",
          "triangular",
          "flag",
          "on",
          "post",
          "flags"
        ]
      },
      {
        "value": "🎌",
        "keywords": [
          "crossed flags",
          "crossed",
          "flags",
          "flag"
        ]
      },
      {
        "value": "🏴",
        "keywords": [
          "waving black flag",
          "waving",
          "black",
          "flag",
          "flags"
        ]
      },
      {
        "value": "🏳️",
        "keywords": [
          "waving white flag",
          "waving",
          "white",
          "flag",
          "white flag",
          "flags"
        ]
      },
      {
        "value": "🏳️‍🌈",
        "keywords": [
          "rainbow-flag",
          "rainbow flag",
          "flags",
          "flag"
        ]
      },
      {
        "value": "🏳️‍⚧️",
        "keywords": [
          "transgender flag",
          "transgender",
          "flag",
          "flags"
        ]
      },
      {
        "value": "🏴‍☠️",
        "keywords": [
          "pirate flag",
          "pirate",
          "flag",
          "flags"
        ]
      },
      {
        "value": "🇦🇨",
        "keywords": [
          "flag-ac",
          "ascension island flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇩",
        "keywords": [
          "flag-ad",
          "andorra flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇪",
        "keywords": [
          "flag-ae",
          "united arab emirates flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇫",
        "keywords": [
          "flag-af",
          "afghanistan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇬",
        "keywords": [
          "flag-ag",
          "antigua barbuda flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇮",
        "keywords": [
          "flag-ai",
          "anguilla flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇱",
        "keywords": [
          "flag-al",
          "albania flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇲",
        "keywords": [
          "flag-am",
          "armenia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇴",
        "keywords": [
          "flag-ao",
          "angola flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇶",
        "keywords": [
          "flag-aq",
          "antarctica flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇷",
        "keywords": [
          "flag-ar",
          "argentina flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇸",
        "keywords": [
          "flag-as",
          "american samoa flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇹",
        "keywords": [
          "flag-at",
          "austria flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇺",
        "keywords": [
          "flag-au",
          "australia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇼",
        "keywords": [
          "flag-aw",
          "aruba flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇽",
        "keywords": [
          "flag-ax",
          "åland islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇦🇿",
        "keywords": [
          "flag-az",
          "azerbaijan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇦",
        "keywords": [
          "flag-ba",
          "bosnia herzegovina flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇧",
        "keywords": [
          "flag-bb",
          "barbados flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇩",
        "keywords": [
          "flag-bd",
          "bangladesh flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇪",
        "keywords": [
          "flag-be",
          "belgium flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇫",
        "keywords": [
          "flag-bf",
          "burkina faso flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇬",
        "keywords": [
          "flag-bg",
          "bulgaria flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇭",
        "keywords": [
          "flag-bh",
          "bahrain flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇮",
        "keywords": [
          "flag-bi",
          "burundi flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇯",
        "keywords": [
          "flag-bj",
          "benin flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇱",
        "keywords": [
          "flag-bl",
          "st. barthélemy flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇲",
        "keywords": [
          "flag-bm",
          "bermuda flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇳",
        "keywords": [
          "flag-bn",
          "brunei flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇴",
        "keywords": [
          "flag-bo",
          "bolivia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇶",
        "keywords": [
          "flag-bq",
          "caribbean netherlands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇷",
        "keywords": [
          "flag-br",
          "brazil flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇸",
        "keywords": [
          "flag-bs",
          "bahamas flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇹",
        "keywords": [
          "flag-bt",
          "bhutan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇻",
        "keywords": [
          "flag-bv",
          "bouvet island flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇼",
        "keywords": [
          "flag-bw",
          "botswana flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇾",
        "keywords": [
          "flag-by",
          "belarus flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇧🇿",
        "keywords": [
          "flag-bz",
          "belize flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇦",
        "keywords": [
          "flag-ca",
          "canada flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇨",
        "keywords": [
          "flag-cc",
          "cocos keeling islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇩",
        "keywords": [
          "flag-cd",
          "congo - kinshasa flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇫",
        "keywords": [
          "flag-cf",
          "central african republic flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇬",
        "keywords": [
          "flag-cg",
          "congo - brazzaville flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇭",
        "keywords": [
          "flag-ch",
          "switzerland flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇮",
        "keywords": [
          "flag-ci",
          "côte d’ivoire flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇰",
        "keywords": [
          "flag-ck",
          "cook islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇱",
        "keywords": [
          "flag-cl",
          "chile flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇲",
        "keywords": [
          "flag-cm",
          "cameroon flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇳",
        "keywords": [
          "cn",
          "flag-cn",
          "china flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇴",
        "keywords": [
          "flag-co",
          "colombia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇵",
        "keywords": [
          "flag-cp",
          "clipperton island flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇶",
        "keywords": [
          "flag-sark",
          "sark flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇷",
        "keywords": [
          "flag-cr",
          "costa rica flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇺",
        "keywords": [
          "flag-cu",
          "cuba flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇻",
        "keywords": [
          "flag-cv",
          "cape verde flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇼",
        "keywords": [
          "flag-cw",
          "curaçao flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇽",
        "keywords": [
          "flag-cx",
          "christmas island flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇾",
        "keywords": [
          "flag-cy",
          "cyprus flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇨🇿",
        "keywords": [
          "flag-cz",
          "czechia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇩🇪",
        "keywords": [
          "de",
          "flag-de",
          "germany flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇩🇬",
        "keywords": [
          "flag-dg",
          "diego garcia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇩🇯",
        "keywords": [
          "flag-dj",
          "djibouti flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇩🇰",
        "keywords": [
          "flag-dk",
          "denmark flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇩🇲",
        "keywords": [
          "flag-dm",
          "dominica flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇩🇴",
        "keywords": [
          "flag-do",
          "dominican republic flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇩🇿",
        "keywords": [
          "flag-dz",
          "algeria flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇦",
        "keywords": [
          "flag-ea",
          "ceuta melilla flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇨",
        "keywords": [
          "flag-ec",
          "ecuador flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇪",
        "keywords": [
          "flag-ee",
          "estonia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇬",
        "keywords": [
          "flag-eg",
          "egypt flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇭",
        "keywords": [
          "flag-eh",
          "western sahara flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇷",
        "keywords": [
          "flag-er",
          "eritrea flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇸",
        "keywords": [
          "es",
          "flag-es",
          "spain flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇹",
        "keywords": [
          "flag-et",
          "ethiopia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇪🇺",
        "keywords": [
          "flag-eu",
          "european union flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇫🇮",
        "keywords": [
          "flag-fi",
          "finland flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇫🇯",
        "keywords": [
          "flag-fj",
          "fiji flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇫🇰",
        "keywords": [
          "flag-fk",
          "falkland islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇫🇲",
        "keywords": [
          "flag-fm",
          "micronesia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇫🇴",
        "keywords": [
          "flag-fo",
          "faroe islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇫🇷",
        "keywords": [
          "fr",
          "flag-fr",
          "france flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇦",
        "keywords": [
          "flag-ga",
          "gabon flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇧",
        "keywords": [
          "gb",
          "uk",
          "flag-gb",
          "united kingdom flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇩",
        "keywords": [
          "flag-gd",
          "grenada flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇪",
        "keywords": [
          "flag-ge",
          "georgia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇫",
        "keywords": [
          "flag-gf",
          "french guiana flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇬",
        "keywords": [
          "flag-gg",
          "guernsey flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇭",
        "keywords": [
          "flag-gh",
          "ghana flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇮",
        "keywords": [
          "flag-gi",
          "gibraltar flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇱",
        "keywords": [
          "flag-gl",
          "greenland flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇲",
        "keywords": [
          "flag-gm",
          "gambia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇳",
        "keywords": [
          "flag-gn",
          "guinea flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇵",
        "keywords": [
          "flag-gp",
          "guadeloupe flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇶",
        "keywords": [
          "flag-gq",
          "equatorial guinea flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇷",
        "keywords": [
          "flag-gr",
          "greece flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇸",
        "keywords": [
          "flag-gs",
          "south georgia south sandwich islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇹",
        "keywords": [
          "flag-gt",
          "guatemala flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇺",
        "keywords": [
          "flag-gu",
          "guam flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇼",
        "keywords": [
          "flag-gw",
          "guinea-bissau flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇬🇾",
        "keywords": [
          "flag-gy",
          "guyana flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇭🇰",
        "keywords": [
          "flag-hk",
          "hong kong sar china flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇭🇲",
        "keywords": [
          "flag-hm",
          "heard mcdonald islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇭🇳",
        "keywords": [
          "flag-hn",
          "honduras flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇭🇷",
        "keywords": [
          "flag-hr",
          "croatia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇭🇹",
        "keywords": [
          "flag-ht",
          "haiti flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇭🇺",
        "keywords": [
          "flag-hu",
          "hungary flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇨",
        "keywords": [
          "flag-ic",
          "canary islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇩",
        "keywords": [
          "flag-id",
          "indonesia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇪",
        "keywords": [
          "flag-ie",
          "ireland flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇱",
        "keywords": [
          "flag-il",
          "israel flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇲",
        "keywords": [
          "flag-im",
          "isle of man flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇳",
        "keywords": [
          "flag-in",
          "india flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇴",
        "keywords": [
          "flag-io",
          "british indian ocean territory flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇶",
        "keywords": [
          "flag-iq",
          "iraq flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇷",
        "keywords": [
          "flag-ir",
          "iran flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇸",
        "keywords": [
          "flag-is",
          "iceland flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇮🇹",
        "keywords": [
          "it",
          "flag-it",
          "italy flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇯🇪",
        "keywords": [
          "flag-je",
          "jersey flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇯🇲",
        "keywords": [
          "flag-jm",
          "jamaica flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇯🇴",
        "keywords": [
          "flag-jo",
          "jordan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇯🇵",
        "keywords": [
          "jp",
          "flag-jp",
          "japan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇪",
        "keywords": [
          "flag-ke",
          "kenya flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇬",
        "keywords": [
          "flag-kg",
          "kyrgyzstan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇭",
        "keywords": [
          "flag-kh",
          "cambodia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇮",
        "keywords": [
          "flag-ki",
          "kiribati flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇲",
        "keywords": [
          "flag-km",
          "comoros flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇳",
        "keywords": [
          "flag-kn",
          "st. kitts nevis flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇵",
        "keywords": [
          "flag-kp",
          "north korea flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇷",
        "keywords": [
          "kr",
          "flag-kr",
          "south korea flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇼",
        "keywords": [
          "flag-kw",
          "kuwait flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇾",
        "keywords": [
          "flag-ky",
          "cayman islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇰🇿",
        "keywords": [
          "flag-kz",
          "kazakhstan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇦",
        "keywords": [
          "flag-la",
          "laos flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇧",
        "keywords": [
          "flag-lb",
          "lebanon flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇨",
        "keywords": [
          "flag-lc",
          "st. lucia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇮",
        "keywords": [
          "flag-li",
          "liechtenstein flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇰",
        "keywords": [
          "flag-lk",
          "sri lanka flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇷",
        "keywords": [
          "flag-lr",
          "liberia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇸",
        "keywords": [
          "flag-ls",
          "lesotho flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇹",
        "keywords": [
          "flag-lt",
          "lithuania flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇺",
        "keywords": [
          "flag-lu",
          "luxembourg flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇻",
        "keywords": [
          "flag-lv",
          "latvia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇱🇾",
        "keywords": [
          "flag-ly",
          "libya flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇦",
        "keywords": [
          "flag-ma",
          "morocco flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇨",
        "keywords": [
          "flag-mc",
          "monaco flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇩",
        "keywords": [
          "flag-md",
          "moldova flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇪",
        "keywords": [
          "flag-me",
          "montenegro flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇫",
        "keywords": [
          "flag-mf",
          "st. martin flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇬",
        "keywords": [
          "flag-mg",
          "madagascar flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇭",
        "keywords": [
          "flag-mh",
          "marshall islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇰",
        "keywords": [
          "flag-mk",
          "north macedonia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇱",
        "keywords": [
          "flag-ml",
          "mali flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇲",
        "keywords": [
          "flag-mm",
          "myanmar burma flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇳",
        "keywords": [
          "flag-mn",
          "mongolia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇴",
        "keywords": [
          "flag-mo",
          "macao sar china flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇵",
        "keywords": [
          "flag-mp",
          "northern mariana islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇶",
        "keywords": [
          "flag-mq",
          "martinique flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇷",
        "keywords": [
          "flag-mr",
          "mauritania flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇸",
        "keywords": [
          "flag-ms",
          "montserrat flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇹",
        "keywords": [
          "flag-mt",
          "malta flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇺",
        "keywords": [
          "flag-mu",
          "mauritius flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇻",
        "keywords": [
          "flag-mv",
          "maldives flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇼",
        "keywords": [
          "flag-mw",
          "malawi flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇽",
        "keywords": [
          "flag-mx",
          "mexico flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇾",
        "keywords": [
          "flag-my",
          "malaysia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇲🇿",
        "keywords": [
          "flag-mz",
          "mozambique flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇦",
        "keywords": [
          "flag-na",
          "namibia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇨",
        "keywords": [
          "flag-nc",
          "new caledonia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇪",
        "keywords": [
          "flag-ne",
          "niger flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇫",
        "keywords": [
          "flag-nf",
          "norfolk island flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇬",
        "keywords": [
          "flag-ng",
          "nigeria flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇮",
        "keywords": [
          "flag-ni",
          "nicaragua flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇱",
        "keywords": [
          "flag-nl",
          "netherlands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇴",
        "keywords": [
          "flag-no",
          "norway flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇵",
        "keywords": [
          "flag-np",
          "nepal flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇷",
        "keywords": [
          "flag-nr",
          "nauru flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇺",
        "keywords": [
          "flag-nu",
          "niue flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇳🇿",
        "keywords": [
          "flag-nz",
          "new zealand flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇴🇲",
        "keywords": [
          "flag-om",
          "oman flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇦",
        "keywords": [
          "flag-pa",
          "panama flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇪",
        "keywords": [
          "flag-pe",
          "peru flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇫",
        "keywords": [
          "flag-pf",
          "french polynesia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇬",
        "keywords": [
          "flag-pg",
          "papua new guinea flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇭",
        "keywords": [
          "flag-ph",
          "philippines flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇰",
        "keywords": [
          "flag-pk",
          "pakistan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇱",
        "keywords": [
          "flag-pl",
          "poland flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇲",
        "keywords": [
          "flag-pm",
          "st. pierre miquelon flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇳",
        "keywords": [
          "flag-pn",
          "pitcairn islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇷",
        "keywords": [
          "flag-pr",
          "puerto rico flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇸",
        "keywords": [
          "flag-ps",
          "palestinian territories flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇹",
        "keywords": [
          "flag-pt",
          "portugal flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇼",
        "keywords": [
          "flag-pw",
          "palau flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇵🇾",
        "keywords": [
          "flag-py",
          "paraguay flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇶🇦",
        "keywords": [
          "flag-qa",
          "qatar flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇷🇪",
        "keywords": [
          "flag-re",
          "réunion flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇷🇴",
        "keywords": [
          "flag-ro",
          "romania flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇷🇸",
        "keywords": [
          "flag-rs",
          "serbia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇷🇺",
        "keywords": [
          "ru",
          "flag-ru",
          "russia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇷🇼",
        "keywords": [
          "flag-rw",
          "rwanda flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇦",
        "keywords": [
          "flag-sa",
          "saudi arabia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇧",
        "keywords": [
          "flag-sb",
          "solomon islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇨",
        "keywords": [
          "flag-sc",
          "seychelles flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇩",
        "keywords": [
          "flag-sd",
          "sudan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇪",
        "keywords": [
          "flag-se",
          "sweden flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇬",
        "keywords": [
          "flag-sg",
          "singapore flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇭",
        "keywords": [
          "flag-sh",
          "st. helena flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇮",
        "keywords": [
          "flag-si",
          "slovenia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇯",
        "keywords": [
          "flag-sj",
          "svalbard jan mayen flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇰",
        "keywords": [
          "flag-sk",
          "slovakia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇱",
        "keywords": [
          "flag-sl",
          "sierra leone flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇲",
        "keywords": [
          "flag-sm",
          "san marino flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇳",
        "keywords": [
          "flag-sn",
          "senegal flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇴",
        "keywords": [
          "flag-so",
          "somalia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇷",
        "keywords": [
          "flag-sr",
          "suriname flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇸",
        "keywords": [
          "flag-ss",
          "south sudan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇹",
        "keywords": [
          "flag-st",
          "são tomé príncipe flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇻",
        "keywords": [
          "flag-sv",
          "el salvador flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇽",
        "keywords": [
          "flag-sx",
          "sint maarten flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇾",
        "keywords": [
          "flag-sy",
          "syria flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇸🇿",
        "keywords": [
          "flag-sz",
          "eswatini flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇦",
        "keywords": [
          "flag-ta",
          "tristan da cunha flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇨",
        "keywords": [
          "flag-tc",
          "turks caicos islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇩",
        "keywords": [
          "flag-td",
          "chad flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇫",
        "keywords": [
          "flag-tf",
          "french southern territories flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇬",
        "keywords": [
          "flag-tg",
          "togo flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇭",
        "keywords": [
          "flag-th",
          "thailand flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇯",
        "keywords": [
          "flag-tj",
          "tajikistan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇰",
        "keywords": [
          "flag-tk",
          "tokelau flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇱",
        "keywords": [
          "flag-tl",
          "timor-leste flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇲",
        "keywords": [
          "flag-tm",
          "turkmenistan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇳",
        "keywords": [
          "flag-tn",
          "tunisia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇴",
        "keywords": [
          "flag-to",
          "tonga flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇷",
        "keywords": [
          "flag-tr",
          "türkiye flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇹",
        "keywords": [
          "flag-tt",
          "trinidad tobago flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇻",
        "keywords": [
          "flag-tv",
          "tuvalu flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇼",
        "keywords": [
          "flag-tw",
          "taiwan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇹🇿",
        "keywords": [
          "flag-tz",
          "tanzania flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇺🇦",
        "keywords": [
          "flag-ua",
          "ukraine flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇺🇬",
        "keywords": [
          "flag-ug",
          "uganda flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇺🇲",
        "keywords": [
          "flag-um",
          "u.s. outlying islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇺🇳",
        "keywords": [
          "flag-un",
          "united nations flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇺🇸",
        "keywords": [
          "us",
          "flag-us",
          "united states flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇺🇾",
        "keywords": [
          "flag-uy",
          "uruguay flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇺🇿",
        "keywords": [
          "flag-uz",
          "uzbekistan flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇻🇦",
        "keywords": [
          "flag-va",
          "vatican city flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇻🇨",
        "keywords": [
          "flag-vc",
          "st. vincent grenadines flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇻🇪",
        "keywords": [
          "flag-ve",
          "venezuela flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇻🇬",
        "keywords": [
          "flag-vg",
          "british virgin islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇻🇮",
        "keywords": [
          "flag-vi",
          "u.s. virgin islands flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇻🇳",
        "keywords": [
          "flag-vn",
          "vietnam flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇻🇺",
        "keywords": [
          "flag-vu",
          "vanuatu flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇼🇫",
        "keywords": [
          "flag-wf",
          "wallis futuna flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇼🇸",
        "keywords": [
          "flag-ws",
          "samoa flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇽🇰",
        "keywords": [
          "flag-xk",
          "kosovo flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇾🇪",
        "keywords": [
          "flag-ye",
          "yemen flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇾🇹",
        "keywords": [
          "flag-yt",
          "mayotte flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇿🇦",
        "keywords": [
          "flag-za",
          "south africa flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇿🇲",
        "keywords": [
          "flag-zm",
          "zambia flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🇿🇼",
        "keywords": [
          "flag-zw",
          "zimbabwe flag",
          "flags",
          "country-flag"
        ]
      },
      {
        "value": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "keywords": [
          "flag-england",
          "england flag",
          "flags",
          "subdivision-flag"
        ]
      },
      {
        "value": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
        "keywords": [
          "flag-scotland",
          "scotland flag",
          "flags",
          "subdivision-flag"
        ]
      },
      {
        "value": "🏴󠁧󠁢󠁷󠁬󠁳󠁿",
        "keywords": [
          "flag-wales",
          "wales flag",
          "flags",
          "subdivision-flag"
        ]
      }
    ]
  }
] as EmojiCategoryData[];
