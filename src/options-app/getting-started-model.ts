export { gettingStartedPath, gettingStartedView } from "../getting-started-route";

export const gettingStartedChoices = Object.freeze({
    typeHangul: "type-hangul",
    otherTools: "other-tools",
});

export type GettingStartedChoice = (typeof gettingStartedChoices)[keyof typeof gettingStartedChoices];
