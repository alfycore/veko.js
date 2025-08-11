/**
 * This file is for the framework veko.js
 * This file is destined for the NextFunction handling
 */

class Next {
    constructor() {
        this.error = null;
        this.called = false;
    }

    call(err) {
        if (this.called) return;
        this.called = true;
        this.error = err || null;
        return this;
    }

    hasError() {
        return this.error !== null;
    }

    getError() {
        return this.error;
    }

    isCalled() {
        return this.called;
    }

    reset() {
        this.error = null;
        this.called = false;
        return this;
    }
}

function createNext() {
    const next = new Next();
    return (err) => next.call(err);
}