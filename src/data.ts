
export const minions = {
    Umbra: {
        name: "Umbra",
        initial: "U",
        color: "#904090",
        mechanic: "Core",
        textLines: ["Break your way out!",
            "You must avoid the Arch-Glacor's core",
            "I knew you could do it, World Guardian",
            "Sunder the arms",
            "You can't be in such close proximity to its core",
            "Get out of there",
            "Its icy core will destroy you",
            "Break through its limbs if you must",
            "Get away from its heart",
            "It's a trap",
            "Nothing can withstand that amount",
            "Smash your way out",
            "Break through the arms",
            "Destroy the arms",
            "The exposed core is certain death",
        "The best approach is often the simplest",
    "This might just work!",
"Do not celebrate yet, it will regrow",
"Not vital, but damage nonetheless",
"Well...that'll do it.",
"Well that'll do it...",
"Ariane: Excellent.",
"Ariane: Keep going!",
"Ariane: Not bad!",
"Ariane: That's it!",
"Ariane: This might just work!"
]
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
        textLines: ["It's that giant beam", "Ready your defences", "Steel yourself", "Brace yourself", "Stand firm", "Ready your defences",
            "Ariane: Block! Now",
            "It's charging! So much energy...",
            "What enormous power...",
            "Fortify yourself.",
            "Can't dodge that..."
        ]
    },
    Fumus: {
        name: "Fumus",
        initial: "F",
        color: "#FFFFFF",
        mechanic: "Beams",
        textLines: ["Dodge those beams!",
            "Run, World Guardian",
            "Dodge the ice beams",
            "Those aren't beams of Sunshine",
            "From above!", "Run...World Guardian",
            "It's that giant beam",
            "The air grows colder yet",
            "Move!"]
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
