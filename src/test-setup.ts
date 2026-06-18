// Silence debug logging in tests. Re-applied before each test so it survives
// suites that call jest.restoreAllMocks() in their own teardown.
beforeEach(() => {
    jest.spyOn(console, "debug").mockImplementation(() => {});

    // jsdom has no layout, so Range#getBoundingClientRect is missing; stub it to a zero
    // rect (production then bails through its normal zero-size path). Guarded because
    // some suites run in the `node` env, which has no `Range`.
    if (typeof Range !== "undefined") {
        Range.prototype.getBoundingClientRect = () =>
            ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
    }
});
