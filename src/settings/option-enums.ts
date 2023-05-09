import { createSelectOption } from "./option-definitions";

export enum PersistOptions {
    AlwaysOff = 0,
    AlwaysOn = 1,
    KeepLastState = 2,
}

export const PersistOptionNames: Record<PersistOptions, string> = {
    [PersistOptions.AlwaysOff]: "Always Off",
    [PersistOptions.AlwaysOn]: "Always On",
    [PersistOptions.KeepLastState]: "Keep Last State",
}

export function createPersistenceOption(description: string) {
    return createSelectOption(
        PersistOptions,
        "Persistence between sessions",
        PersistOptions.AlwaysOff,
        PersistOptionNames,
        description
    );
}
