export type KeyboardState = {
    shift: boolean;
    mouse: {
        down: boolean;
        startX: number;
        startY: number;
    };
    keyboard: {
        x: number;
        y: number;
        element?: HTMLDivElement;
        move?: (dx: number, dy: number) => void;
        sendCharacter?: (key: string) => void;
    };
    isInitialized: boolean;
    isHanMode: boolean;
};
