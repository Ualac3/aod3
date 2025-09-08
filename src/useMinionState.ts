import { useReducer } from "react";
import { dbg } from "./logger"; // adjust path

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
    case "clear": {
      dbg("reducer/CLEAR", { prevLen: state.order.length });
      return { allDead: false, order: [] };
    }

    case "addMinion": {
      const prevLen = state.order.length;
      dbg("reducer/ADD", {
        add: `${action.minion.initial}/${action.minion.mechanic}`,
        prevLen
      });

      const nextOrder = [...state.order, action.minion];
      const nextLen = nextOrder.length;

      dbg("reducer/AFTER", {
        mechanics: nextOrder.map((x) => x.mechanic),
        nextLen
      });

      return { ...state, order: nextOrder, allDead: nextLen === 5 };
    }

    default:
      throw new Error("Invalid action type");
  }
};
const useMinionState = () => useReducer(reducer, defaultState);
export default useMinionState;
