
export const minions = {
    Umbra: {
        name: "Umbra",
        initial: "U",
        color: "#904090",
        mechanic: "Core",
        textLines: ["Break your way out!"]
    },
    Glacies: {
        name: "Glacies",
        initial: "G",
        color: "#2090A0",
        mechanic: "Flurry",
        textLines: ["The Arch-Glacor focuses its attacks"]
    },
    Curor: {
        name: "Cruor",
        initial: "C",
        color: "#A04040",
        mechanic: "Cannon",
        textLines: ["It's that giant beam", "Ready your defences", "Steel yourself, World Guardian", "Brace yourself", "Stand firm"]
    },
    Fumus: {
        name: "Fumus",
        initial: "F",
        color: "#FFFFFF",
        mechanic: "Beams",
        textLines: ["Dodge those beams!", "Run, World Guardian"]
    },
    Michael: {
        name: "Michael",
        initial: "M",
        color: "#FFFFFF",
        mechanic: "Minions",
        textLines: ["They give their lifeforce to protect", "immune to all damage while there are glacytes", "Kill the minions first", "Focus your efforts on the smaller ones", "Kill the glacytes first"]
    },

} as const

export type minion = typeof minions[keyof typeof minions]

export const minionList = Object.values(minions)
