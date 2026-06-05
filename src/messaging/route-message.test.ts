import { routeByAction } from "./route-message";

type Msg = { action: "a"; data: number } | { action: "b"; data: string } | { action: "c" };

describe("routeByAction", () => {
    it("calls the handler matching the action, narrowed to that variant, and no other", () => {
        const onA = jest.fn();
        const onB = jest.fn();

        routeByAction<Msg>({ action: "b", data: "hi" }, { a: onA, b: onB });

        expect(onB).toHaveBeenCalledWith({ action: "b", data: "hi" });
        expect(onA).not.toHaveBeenCalled();
    });

    it("does nothing when no handler is registered for the action", () => {
        const onA = jest.fn();

        expect(() => routeByAction<Msg>({ action: "c" }, { a: onA })).not.toThrow();
        expect(onA).not.toHaveBeenCalled();
    });
});
