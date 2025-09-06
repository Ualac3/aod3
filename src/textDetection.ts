import { getMinionFromInitial } from "./helpers"
import { minions } from "./data"

/*
Transcript2

English

GemEnter - "You enter the competiton."
GemStart - "The challenge gem competition has begun!"
GemEnd - "Challenge Gem competition results:"
GemWin - "12dragon162 won the competition with a score of 23,829!"
GemPlacement - "You came rank 1 with a score of 23,829."
WakeUp - "Nex:  Witness the true power of the elements. The pure power I have wrought into my will"
KillEnd - "Completion Time: 04:13"
PlayerDie - "Oh dear, you are dead!"

Enter instance - "Welcome to your session against: Nex - Angel of Death"
East smoke - "Nex begins to draw smoke from the east towards you!"
North smoke - "Nex begins to draw smoke from the north towards you!"
Pool - "Nex casts thick black smoke towards the centre of the arena."
Bomb - "Nex has marked you to take the full force of the elements."


German

GemEnter - "Du nimmst am Wettbewerb teil."
GemStart - "Der Rivalit  tsstein-Wettbewerb hat begonnen!"
GemEnd - "Ergebnisse des Rivalit  tsstein-Wettbewerbs:"
GemWin - "12dragon162 hat den Wettbewerb mit 4.447 Punkten gewonnen!"
GemPlacement - "Du hast Rang 1 mit 4.447 Punkten erreicht."
WakeUp - "Nex:  Werdet Zeuge der wahren Macht der Elemente. Der reinen Macht, die ich mir untertan gemacht habe."
KillEnd - "Abschlusszeit: 01:04"
PlayerDie - "Oje, du bist tot!"

Enter instance - "Willkommen zu deiner Runde gegen: Nex - Engel des Todes"
East smoke - "Nex zieht Rauch aus dem Osten zu dir hin!"
North smoke - "Nex zieht Rauch aus dem Norden zu dir hin!"
Pool - "Nex leitet dichten, schwarzen Rauch zur Mitte der Arena."
Bomb - "Nex hat dich markiert, um die gesamte Wucht der Elemente abzubekommen."


French

GemEnter - "Vous entrez dans la competition."
GemStart - "La competition de la gemme de defi a commence !"
GemEnd - "Resultats de la competition de la gemme de defi :"
GemWin - "12dragon162 mene la competition avec un score de 10 852 !"
GemPlacement - "Vous avez atteint la 1e place avec un score de 10 852."
WakeUp - "Nex :  Admirez la puissance ultime des elements. Le pouvoir"
KillEnd - "Temps : 01:21"
PlayerDie - "Oh fichtre, vous etes mort !"

Enter instance - "Bienvenue dans votre session de combat contre : Nex : l'ange de la mort."
East smoke - "Nex vous envoie de la fumee venant de l'est !"
North smoke - "Nex se met a diriger la fumee vendant du nord vers vous !"
Pool - "Nex lance une epaisse fumee noire vers le centre de l'arene."
Bomb - "Nex vous prend pour cible : vous allez subir toute la puissance des elements."

*/

const confusedCharacters = [
    ["l", "i", "1"],
    ["o", "0"],
    ["z", "2"],
    ["1", "7"]
]

// Should only be used on text segments as groups e.g [0-9] can be replaced
// Uses the confusedCharacters to adjust regex string with non-capturing groups to allow for OCR inaccuracies
const regexAdjustments = (rawRegexString: string) => {
    // console.log("Initial", rawRegexString)

    confusedCharacters.forEach((list) => {
        const replacement = `(?:${list.join("|")})`

        list.forEach((character) => {
            try {
                rawRegexString = rawRegexString.replaceAll(character, replacement)
            } catch {
                console.error("replaceAll not a function of rawRegexString")
                console.error(rawRegexString)
                console.error(typeof rawRegexString)
            }
        })
    })

    // console.log("Updated", rawRegexString)

    return rawRegexString
}


export const detectKillStart = (text: string) => {
    const translations = [
        `Welcome to your session against: Nex, Angel of Death`,
        `clear`,
        `Willkommen zu deiner Runde gegen: Nex, Engel des Todes`,
        `Bienvenue dans votre session de combat contre : Nex, l'ange de la mort`
    ]
    console.log("RAW: " + text);
    const mainExpression = translations.map((string) => regexAdjustments(string)).join("|")
    // console.log("RAW2: "+ mainExpression);
    const match = text.match(new RegExp(`(${mainExpression})`, "i"))
    // console.log("MATCH", match);

    return !!match
}

// export const detectMinionDeath = (text: string) => {
//     const translations = [`master`, `meister`, `ma`]

//     const mainExpression = translations.map((string) => regexAdjustments(string)).join("|")

//     const match = text.match(new RegExp(`(umb|glac|cru|fum|mi).*(${mainExpression})`, "i"))

//     if (match) {
//         const minion = match[0].substring(0, 1)

//         return getMinionFromInitial(minion)
//     }
// }

// export const detectMinionDeath = (text: string) => {
//     const lower = text.toLowerCase();
//     console.log("LOWER: " + lower);

//     for (const m of Object.values(minions)) {
//         for (const line of m.textLines) {
//             const adjustedPattern = regexAdjustments(line.toLowerCase());
//             const regex = new RegExp(adjustedPattern, "i");

//             // console.log("LINE (adjusted regex): " + adjustedPattern);

//             if (regex.test(lower)) {
//                 console.log("TRUE");
//                 return getMinionFromInitial(m.initial); // or m.name / m.initial
//             }
//         }
//     }
// };
export const detectMinionDeath = (text: string) => {
  const lower = text.toLowerCase();
  console.log("[detectMinionDeath] INPUT:", lower);

  for (const m of Object.values(minions)) {
    for (const rawLine of m.textLines) {
      const adjusted = regexAdjustments(rawLine.toLowerCase());
      const rx = new RegExp(adjusted, "i");
      const hit = rx.test(lower);
      if (hit) {
        const res = getMinionFromInitial(m.initial);
        console.log("[detectMinionDeath] MATCH", {
          initial: m.initial,
          name: m.name,
          rawLine,
          adjusted,
          resultType: typeof res,
          result: res,
        });
        return res; // <- verify this is the object your pipeline expects
      }
    }
  }
}