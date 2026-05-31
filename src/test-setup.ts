// Silence debug logging in tests. Re-applied before each test so it survives
// suites that call jest.restoreAllMocks() in their own teardown.
beforeEach(() => {
    jest.spyOn(console, "debug").mockImplementation(() => {});
});
