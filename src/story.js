// Chaque scène : texte, choix (vers une autre scène), et options :
// item : objet ramassé en arrivant, requires : objet nécessaire pour voir le choix, fin : "victoire" | "defaite"
export const START = 'reveil';

export const scenes = {
  reveil: {
    text: "Tu te réveilles au pied d'un grand chêne, au cœur d'une forêt inconnue. La brume est épaisse. Deux sentiers s'offrent à toi, et une lueur vacille au loin.",
    choices: [
      { label: 'Suivre le sentier de gauche', to: 'riviere' },
      { label: 'Suivre le sentier de droite', to: 'cabane' },
      { label: 'Marcher vers la lueur', to: 'grotte' },
    ],
  },
  riviere: {
    text: "Une rivière rapide te barre la route. Sur la berge, une vieille lanterne éteinte est posée près d'une barque pourrie.",
    item: 'lanterne',
    choices: [
      { label: 'Traverser à la nage', to: 'noyade' },
      { label: 'Rebrousser chemin', to: 'reveil' },
    ],
  },
  noyade: {
    text: "Le courant est bien trop fort. Tu es emporté, et tout devient noir...",
    fin: 'defaite',
    choices: [],
  },
  cabane: {
    text: "Une cabane de bûcheron, abandonnée. Sur la table : une clé rouillée. Un escalier descend vers une cave obscure.",
    item: 'clé',
    choices: [
      { label: 'Descendre dans la cave', to: 'cave', requires: 'lanterne', hint: "Il fait trop noir sans lumière..." },
      { label: 'Retourner au chêne', to: 'reveil' },
    ],
  },
  cave: {
    text: "Grâce à ta lanterne, tu découvres un coffre scellé au fond de la cave. Sa serrure est ancienne.",
    choices: [
      { label: 'Ouvrir le coffre avec la clé', to: 'tresor', requires: 'clé', hint: 'Il te faut une clé.' },
      { label: 'Remonter', to: 'cabane' },
    ],
  },
  tresor: {
    text: "Le coffre s'ouvre : il contient une couronne d'or et une carte menant hors de la forêt. Tu es libre, et riche. Bravo, aventurier !",
    fin: 'victoire',
    choices: [],
  },
  grotte: {
    text: "La lueur vient d'une grotte. Un dragon endormi veille sur un tas d'or. Il ouvre un œil.",
    choices: [
      { label: "Tenter de lui voler de l'or", to: 'dragon' },
      { label: 'Fuir doucement', to: 'reveil' },
    ],
  },
  dragon: {
    text: "Le dragon se réveille dans un rugissement. Ce fut ta dernière aventure...",
    fin: 'defaite',
    choices: [],
  },
};
