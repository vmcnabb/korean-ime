import { isMethodSupported, methodNotSupported } from "./method-not-supported";

class Base {
    supported(): string {
        return "ok";
    }

    @methodNotSupported
    unsupported(): string {
        return "never reached";
    }
}

class Derived extends Base {
    @methodNotSupported
    alsoUnsupported(): void {}
}

describe("methodNotSupported", () => {
    it("replaces the decorated method with one that throws", () => {
        const instance = new Base();
        expect(() => instance.unsupported()).toThrow('Method "unsupported" is not supported.');
    });

    it("reports a decorated method as unsupported", () => {
        expect(isMethodSupported(new Base(), "unsupported")).toBe(false);
    });

    it("reports a non-decorated method as supported", () => {
        expect(isMethodSupported(new Base(), "supported")).toBe(true);
    });

    it("resolves through the prototype chain — decorator on a base class, query on a subclass instance", () => {
        const instance = new Derived();
        expect(isMethodSupported(instance, "unsupported")).toBe(false);
        expect(isMethodSupported(instance, "alsoUnsupported")).toBe(false);
        expect(isMethodSupported(instance, "supported")).toBe(true);
    });
});
