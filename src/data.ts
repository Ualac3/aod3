
export const minions = {
    Umbra: {
        name: "Umbra",
        initial: "U",
        color: "#904090",
    },
    Glacies: {
        name: "Glacies",
        initial: "G",
        color: "#2090A0",
    },
    Curor: {
        name: "Cruor",
        initial: "C",
        color: "#A04040",
    },
    Fumus: {
        name: "Fumus",
        initial: "F",
        color: "#FFFFFF",
    },
     Michael: {
        name: "Michael",
        initial: "M",
        color: "#FFFFFF",
    },

} as const

export type minion = typeof minions[keyof typeof minions]

export const minionList = Object.values(minions)
