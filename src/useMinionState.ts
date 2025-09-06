import { useReducer } from "react";

export type State = {
    allDead: boolean;
    order: { mechanic: string; initial: string; name: string }[]; // adjust to your minion object shape
};

type clearStateAction = { type: "clear" };
type addMinionAction = { type: "addMinion"; minion: State["order"][number] };

type Action = clearStateAction | addMinionAction;

const defaultState: State = {
    allDead: false,
    order: [],
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "clear":
      console.log("[reducer] CLEAR called. Resetting state to empty order.");
      return { allDead: false, order: [] };

    case "addMinion": {
      // NO DEDUPE — just append
      const nextOrder = [...state.order, action.minion];
      const allDead = nextOrder.length === 5;
      console.log("[reducer] order after add (mechanics):", nextOrder.map(m => m.mechanic));
      return { ...state, order: nextOrder, allDead };
    }

    default:
      throw new Error("Invalid action type");
  }
};
const useMinionState = () => useReducer(reducer, defaultState);
export default useMinionState;
