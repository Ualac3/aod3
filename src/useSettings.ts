import { useReducer } from "react"

export const messages = {
    newKillMessage: "Start of kill confirmation",
    smokeMessage: "Smoke warning",
    poolMessage: "Pool warning",
    bombMessage: "Bomb warning"
}

type MessageConfig = { text: boolean; volume: number }
export type MessageTypes = keyof typeof messages
type displayType = "Letters" | "Numbers"

type Settings = Record<MessageTypes, MessageConfig> & {
    displayType: displayType
    orderMessage: { volume: number }
}

const defaultSettings: Settings = {
    displayType: "Letters",
    newKillMessage: { text: true, volume: 0 },
    smokeMessage: { text: true, volume: 0 },
    poolMessage: { text: true, volume: 0 },
    bombMessage: { text: true, volume: 0 },
    orderMessage: { volume: 0 }
}

type setTextSettingValue = {
    message: MessageTypes
    type: "text"
    newValue: boolean
}

type setVolumeSettingValue = {
    message: MessageTypes | "orderMessage"
    type: "volume"
    newValue: number
}

type setDisplayType = {
    type: "setDisplayType"
    newValue: displayType
}

type setSettingValue = setTextSettingValue | setVolumeSettingValue | setDisplayType

const reducer = (state: Settings, action: setSettingValue): Settings => {
    const tempState = { ...state }

    if (action.type === "setDisplayType") {
        tempState.displayType = action.newValue

        localStorage.setItem("settings", JSON.stringify(tempState))

        return tempState
    }

    tempState[action.message][action.type] = action.newValue

    localStorage.setItem("settings", JSON.stringify(tempState))


    return tempState
}

const settingsAtBoot: Settings = JSON.parse(localStorage.getItem("settings") || JSON.stringify(defaultSettings))


const useSettings = () => useReducer(reducer, settingsAtBoot)

export default useSettings
