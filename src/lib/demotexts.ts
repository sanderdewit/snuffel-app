// Sample content for screenshot mode (demo.ts) in every app language: the owner's
// question to the AI and the entries in Bobbie's health file. Same meaning in every
// language. The question follows the app's form of address in that language: where the
// app says "du/tu/ti" but the AI would answer formally without a cue (de, et, hr, hu,
// it, lv, mk, pl, ro, sq, sr), it asks the assistant informally ("Meinst du ..."), so
// the real answer in the screenshot speaks like the rest of the app. Where the app is
// formal, the question has no informal word (in Greek not even the preposition "σε").
// Portuguese is European ("está a beber"). Pure data, so tests can read it.

export interface DemoTexts {
  question: string;
  allergy: string;          // allergy entry (title)
  earInfection: string;     // vet visit (title)
  earCleaned: string;       // vet visit (details)
  earDrops: string;         // medication (title)
  earDropsDose: string;     // medication (details)
  barks: string;            // behaviour (title)
  barksPractice: string;    // behaviour (details)
}

export const DEMO_TEXTS: Record<string, DemoTexts> = {
  bg: {
    question: "Bobbie от вчера яде по-малко и е малко отпаднала, но пие вода. Трябва ли да я заведа на ветеринар?",
    allergy: "Пилешко (сърбеж и възпаление на ушите)",
    earInfection: "Възпаление на лявото ухо", earCleaned: "Ухото е почистено, контролен преглед след 2 седмици.",
    earDrops: "Капки за уши", earDropsDose: "2 пъти дневно, 7 дни",
    barks: "Лае по куриера", barksPractice: "Упражняваме награждаване на вратата."
  },
  ca: {
    question: "Des d'ahir la Bobbie menja menys i està una mica decaiguda, però beu. Hauria d'anar al veterinari?",
    allergy: "Pollastre (picor i otitis)",
    earInfection: "Otitis a l'orella esquerra", earCleaned: "Orella netejada, revisió d'aquí a 2 setmanes.",
    earDrops: "Gotes per a les orelles", earDropsDose: "2 cops al dia, 7 dies",
    barks: "Borda al repartidor", barksPractice: "Practiquem amb premis a la porta."
  },
  cs: {
    question: "Bobbie od včerejška méně žere a je trochu malátná, ale pije. Mám s ní jít k veterináři?",
    allergy: "Kuřecí (svědění a záněty uší)",
    earInfection: "Zánět levého ucha", earCleaned: "Ucho vyčištěno, kontrola za 2 týdny.",
    earDrops: "Ušní kapky", earDropsDose: "2× denně, 7 dní",
    barks: "Štěká na kurýra", barksPractice: "Trénujeme odměňování u dveří."
  },
  da: {
    question: "Bobbie har spist mindre siden i går og virker lidt sløj, men hun drikker. Skal jeg til dyrlægen?",
    allergy: "Kylling (kløe og ørebetændelse)",
    earInfection: "Ørebetændelse, venstre", earCleaned: "Øret renset, kontrol om 2 uger.",
    earDrops: "Øredråber", earDropsDose: "2 gange om dagen i 7 dage",
    barks: "Gør ad budet", barksPractice: "Øver med belønning ved døren."
  },
  de: {
    question: "Bobbie frisst seit gestern weniger und ist etwas schlapp, trinkt aber. Meinst du, ich sollte mit ihr zum Tierarzt?",
    allergy: "Huhn (Juckreiz und Ohrentzündungen)",
    earInfection: "Ohrentzündung links", earCleaned: "Ohr gereinigt, Kontrolle nach 2 Wochen.",
    earDrops: "Ohrentropfen", earDropsDose: "2× täglich, 7 Tage",
    barks: "Bellt den Paketboten an", barksPractice: "Wir üben Belohnen an der Tür."
  },
  el: {
    question: "Από χθες η Bobbie τρώει λιγότερο και είναι λίγο άκεφη, αλλά πίνει νερό. Πρέπει να την πάω στον κτηνίατρο;",
    allergy: "Κοτόπουλο (φαγούρα και ωτίτιδες)",
    earInfection: "Ωτίτιδα, αριστερό αυτί", earCleaned: "Καθαρισμός αυτιού, επανέλεγχος σε 2 εβδομάδες.",
    earDrops: "Ωτικές σταγόνες", earDropsDose: "2 φορές την ημέρα, 7 ημέρες",
    barks: "Γαβγίζει στον κούριερ", barksPractice: "Εξάσκηση με επιβράβευση στην πόρτα."
  },
  en: {
    question: "Since yesterday Bobbie is eating less and seems a bit lethargic, but she is drinking. Should I see a vet?",
    allergy: "Chicken (itching and ear infections)",
    earInfection: "Ear infection, left", earCleaned: "Ear cleaned, check-up after 2 weeks.",
    earDrops: "Ear drops", earDropsDose: "Twice a day, 7 days",
    barks: "Barks at the delivery driver", barksPractice: "Practising rewards at the door."
  },
  es: {
    question: "Desde ayer Bobbie come menos y está algo decaída, pero bebe. ¿Debería llevarla al veterinario?",
    allergy: "Pollo (picor y otitis)",
    earInfection: "Otitis en el oído izquierdo", earCleaned: "Oído limpiado, revisión en 2 semanas.",
    earDrops: "Gotas para los oídos", earDropsDose: "2 veces al día, 7 días",
    barks: "Ladra al repartidor", barksPractice: "Practicamos con premios en la puerta."
  },
  et: {
    question: "Bobbie on eilsest saati vähem söönud ja on natuke loid, aga joob. Mis sa arvad, kas peaksin temaga loomaarsti juurde minema?",
    allergy: "Kana (sügelus ja kõrvapõletikud)",
    earInfection: "Kõrvapõletik, vasak", earCleaned: "Kõrv puhastatud, kontroll 2 nädala pärast.",
    earDrops: "Kõrvatilgad", earDropsDose: "2 korda päevas, 7 päeva",
    barks: "Haugub kulleri peale", barksPractice: "Harjutame ukse juures preemiaga."
  },
  fi: {
    question: "Bobbie on syönyt eilisestä asti vähemmän ja vaikuttaa vähän väsyneeltä, mutta juo kyllä. Pitäisikö minun mennä eläinlääkäriin?",
    allergy: "Kana (kutina ja korvatulehdukset)",
    earInfection: "Korvatulehdus, vasen", earCleaned: "Korva puhdistettu, tarkastus 2 viikon päästä.",
    earDrops: "Korvatipat", earDropsDose: "2 kertaa päivässä, 7 päivää",
    barks: "Haukkuu lähettiä", barksPractice: "Harjoitellaan palkitsemista ovella."
  },
  fr: {
    question: "Depuis hier, Bobbie mange moins et semble un peu abattue, mais elle boit. Dois-je l'emmener chez le vétérinaire ?",
    allergy: "Poulet (démangeaisons et otites)",
    earInfection: "Otite, oreille gauche", earCleaned: "Oreille nettoyée, contrôle dans 2 semaines.",
    earDrops: "Gouttes auriculaires", earDropsDose: "2 fois par jour, 7 jours",
    barks: "Aboie après le livreur", barksPractice: "Entraînement avec récompenses à la porte."
  },
  hr: {
    question: "Bobbie od jučer manje jede i malo je bezvoljna, ali pije. Što ti misliš, trebam li je odvesti veterinaru?",
    allergy: "Piletina (svrbež i upale uha)",
    earInfection: "Upala lijevog uha", earCleaned: "Uho očišćeno, kontrola za 2 tjedna.",
    earDrops: "Kapi za uši", earDropsDose: "2 puta dnevno, 7 dana",
    barks: "Laje na dostavljača", barksPractice: "Vježbamo nagrađivanje na vratima."
  },
  hu: {
    question: "Bobbie tegnap óta kevesebbet eszik, és kicsit levertnek tűnik, de iszik. Te mit gondolsz, el kell vinnem állatorvoshoz?",
    allergy: "Csirke (viszketés és fülgyulladás)",
    earInfection: "Fülgyulladás, bal", earCleaned: "Fül kitisztítva, kontroll 2 hét múlva.",
    earDrops: "Fülcsepp", earDropsDose: "Naponta 2×, 7 napig",
    barks: "Megugatja a futárt", barksPractice: "Jutalmazást gyakorlunk az ajtónál."
  },
  is: {
    question: "Bobbie hefur borðað minna síðan í gær og er dálítið slöpp, en hún drekkur. Ætti ég að fara með hana til dýralæknis?",
    allergy: "Kjúklingur (kláði og eyrnabólga)",
    earInfection: "Eyrnabólga, vinstra eyra", earCleaned: "Eyrað hreinsað, eftirlit eftir 2 vikur.",
    earDrops: "Eyrnadropar", earDropsDose: "2 sinnum á dag í 7 daga",
    barks: "Geltir á sendilinn", barksPractice: "Æfum verðlaun við dyrnar."
  },
  it: {
    question: "Da ieri Bobbie mangia meno ed è un po' abbattuta, però beve. Tu che dici, devo portarla dal veterinario?",
    allergy: "Pollo (prurito e otiti)",
    earInfection: "Otite, orecchio sinistro", earCleaned: "Orecchio pulito, controllo tra 2 settimane.",
    earDrops: "Gocce auricolari", earDropsDose: "2 volte al giorno, 7 giorni",
    barks: "Abbaia al corriere", barksPractice: "Ci esercitiamo con premi alla porta."
  },
  lt: {
    question: "Bobbie nuo vakar mažiau ėda ir atrodo kiek vangi, bet geria. Ar man reikėtų eiti pas veterinarą?",
    allergy: "Vištiena (niežulys ir ausų uždegimai)",
    earInfection: "Kairės ausies uždegimas", earCleaned: "Ausis išvalyta, kontrolė po 2 savaičių.",
    earDrops: "Ausų lašai", earDropsDose: "2 kartus per dieną, 7 dienas",
    barks: "Loja ant kurjerio", barksPractice: "Mokomės su skanėstais prie durų."
  },
  lv: {
    question: "Bobbie kopš vakardienas ēd mazāk un ir mazliet gurdena, bet dzer. Kā tev šķiet, vai man jāiet pie veterinārārsta?",
    allergy: "Vista (nieze un ausu iekaisumi)",
    earInfection: "Kreisās auss iekaisums", earCleaned: "Auss iztīrīta, kontrole pēc 2 nedēļām.",
    earDrops: "Ausu pilieni", earDropsDose: "2 reizes dienā, 7 dienas",
    barks: "Rej uz kurjeru", barksPractice: "Trenējamies ar atlīdzību pie durvīm."
  },
  mk: {
    question: "Bobbie од вчера јаде помалку и е малку отпадната, но пие. Ти што мислиш, треба ли да ја однесам на ветеринар?",
    allergy: "Пилешко (чешање и воспаление на ушите)",
    earInfection: "Воспаление на левото уво", earCleaned: "Увото е исчистено, контрола за 2 недели.",
    earDrops: "Капки за уши", earDropsDose: "2 пати дневно, 7 дена",
    barks: "Лае на доставувачот", barksPractice: "Вежбаме со награди кај вратата."
  },
  nb: {
    question: "Bobbie har spist mindre siden i går og virker litt slapp, men hun drikker. Bør jeg dra til dyrlegen?",
    allergy: "Kylling (kløe og ørebetennelse)",
    earInfection: "Ørebetennelse, venstre", earCleaned: "Øret renset, kontroll om 2 uker.",
    earDrops: "Øredråper", earDropsDose: "2 ganger om dagen i 7 dager",
    barks: "Bjeffer på budet", barksPractice: "Øver med belønning ved døra."
  },
  nl: {
    question: "Bobbie eet sinds gisteren minder en is wat lusteloos, maar drinkt wel. Moet ik naar de dierenarts?",
    allergy: "Kip (jeuk en oorontsteking)",
    earInfection: "Oorontsteking links", earCleaned: "Oor schoongemaakt, controle na 2 weken.",
    earDrops: "Oordruppels", earDropsDose: "2x per dag, 7 dagen",
    barks: "Blaft naar de bezorger", barksPractice: "Oefenen met belonen bij de deur."
  },
  pl: {
    question: "Bobbie od wczoraj mniej je i jest trochę osowiała, ale pije. Czy według ciebie trzeba iść z nią do weterynarza?",
    allergy: "Kurczak (świąd i zapalenie uszu)",
    earInfection: "Zapalenie lewego ucha", earCleaned: "Ucho wyczyszczone, kontrola za 2 tygodnie.",
    earDrops: "Krople do uszu", earDropsDose: "2 razy dziennie, 7 dni",
    barks: "Szczeka na kuriera", barksPractice: "Ćwiczymy nagradzanie przy drzwiach."
  },
  pt: {
    question: "Desde ontem a Bobbie come menos e anda um pouco apática, mas está a beber. Devo levá-la ao veterinário?",
    allergy: "Frango (comichão e otites)",
    earInfection: "Otite, ouvido esquerdo", earCleaned: "Ouvido limpo, revisão daqui a 2 semanas.",
    earDrops: "Gotas para os ouvidos", earDropsDose: "2 vezes por dia, 7 dias",
    barks: "Ladra ao estafeta", barksPractice: "Treino com recompensas à porta."
  },
  ro: {
    question: "Bobbie mănâncă mai puțin de ieri și pare cam abătută, dar bea apă. Tu ce crezi, trebuie s-o duc la veterinar?",
    allergy: "Pui (mâncărime și otite)",
    earInfection: "Otită, urechea stângă", earCleaned: "Ureche curățată, control peste 2 săptămâni.",
    earDrops: "Picături pentru urechi", earDropsDose: "De 2 ori pe zi, 7 zile",
    barks: "Latră la curier", barksPractice: "Exersăm cu recompense la ușă."
  },
  sk: {
    question: "Bobbie od včera menej žerie a je trochu apatická, ale pije. Mám s ňou ísť k veterinárovi?",
    allergy: "Kuracie (svrbenie a zápaly uší)",
    earInfection: "Zápal ľavého ucha", earCleaned: "Ucho vyčistené, kontrola o 2 týždne.",
    earDrops: "Ušné kvapky", earDropsDose: "2× denne, 7 dní",
    barks: "Šteká na kuriéra", barksPractice: "Trénujeme odmeňovanie pri dverách."
  },
  sl: {
    question: "Bobbie od včeraj manj je in je nekoliko brez volje, a pije. Ali naj jo peljem k veterinarju?",
    allergy: "Piščanec (srbenje in vnetja ušes)",
    earInfection: "Vnetje levega ušesa", earCleaned: "Uho očiščeno, kontrola čez 2 tedna.",
    earDrops: "Kapljice za ušesa", earDropsDose: "2-krat na dan, 7 dni",
    barks: "Laja na dostavljavca", barksPractice: "Vadimo nagrajevanje pri vratih."
  },
  sq: {
    question: "Bobbie që dje ha më pak dhe duket pak e lodhur, por pi ujë. Si mendon ti, a duhet ta çoj te veterineri?",
    allergy: "Pulë (kruarje dhe infeksione të veshit)",
    earInfection: "Infeksion i veshit të majtë", earCleaned: "Veshi u pastrua, kontroll pas 2 javësh.",
    earDrops: "Pika për veshët", earDropsDose: "2 herë në ditë, 7 ditë",
    barks: "I leh korrierit", barksPractice: "Ushtrohemi me shpërblime te dera."
  },
  sr: {
    question: "Bobbie od juče manje jede i malo je bezvoljna, ali pije. Šta ti misliš, da li treba da je vodim kod veterinara?",
    allergy: "Piletina (svrab i upale uha)",
    earInfection: "Upala levog uha", earCleaned: "Uho očišćeno, kontrola za 2 nedelje.",
    earDrops: "Kapi za uši", earDropsDose: "2 puta dnevno, 7 dana",
    barks: "Laje na dostavljača", barksPractice: "Vežbamo nagrađivanje na vratima."
  },
  sv: {
    question: "Bobbie har ätit mindre sedan i går och verkar lite hängig, men hon dricker. Borde jag åka till veterinären?",
    allergy: "Kyckling (klåda och öroninflammation)",
    earInfection: "Öroninflammation, vänster", earCleaned: "Örat rengjort, återbesök om 2 veckor.",
    earDrops: "Örondroppar", earDropsDose: "2 gånger om dagen i 7 dagar",
    barks: "Skäller på budet", barksPractice: "Övar med belöning vid dörren."
  },
  uk: {
    question: "Bobbie з учорашнього дня їсть менше і трохи млява, але п’є. Чи варто мені звернутися до ветеринара?",
    allergy: "Курятина (свербіж і запалення вух)",
    earInfection: "Запалення лівого вуха", earCleaned: "Вухо почищено, контроль через 2 тижні.",
    earDrops: "Вушні краплі", earDropsDose: "2 рази на день, 7 днів",
    barks: "Гавкає на кур’єра", barksPractice: "Тренуємо винагороду біля дверей."
  }
};

/** The sample texts for an app language (English when there are none). */
export function demoTexts(lang: string): DemoTexts {
  return DEMO_TEXTS[lang] || DEMO_TEXTS.en;
}
