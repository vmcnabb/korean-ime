import { currentOskSite } from "./osk-site";

describe("currentOskSite", () => {
    it("lowercases the hostname", () => {
        expect(currentOskSite("Example.COM")).toBe("example.com");
    });

    it("strips a single leading www.", () => {
        expect(currentOskSite("www.example.com")).toBe("example.com");
    });

    it("strips only one leading www.", () => {
        expect(currentOskSite("www.www.example.com")).toBe("www.example.com");
    });

    it("keeps subdomains distinct", () => {
        expect(currentOskSite("mail.example.com")).toBe("mail.example.com");
    });

    it("returns undefined for an empty hostname (file://, about:blank)", () => {
        expect(currentOskSite("")).toBeUndefined();
    });
});
