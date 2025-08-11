/**
 * This file is for the framework veko.js
 * This file is destined for the general validation handling
 */

class Validating {
    constructor() {
        this.rules = [];
        this.errors = [];
        this.data = {};
    }

    addRule(field, validator, message) {
        const rule = {
            id: this.rules.length + 1,
            field,
            validator,
            message
        };
        this.rules.push(rule);
        return rule.id;
    }

    deleteRule(ruleId) {
        this.rules = this.rules.filter(rule => rule.id !== ruleId);
        return this;
    }

    updateRule(ruleId, field, validator, message) {
        const ruleIndex = this.rules.findIndex(rule => rule.id === ruleId);
        if (ruleIndex !== -1) {
            this.rules[ruleIndex] = {
                id: ruleId,
                field: field || this.rules[ruleIndex].field,
                validator: validator || this.rules[ruleIndex].validator,
                message: message || this.rules[ruleIndex].message
            };
        }
        return this;
    }

    validate(data) {
        this.data = data || this.data;
        this.errors = [];
        
        this.rules.forEach(rule => {
            const value = this.data[rule.field];
            if (!rule.validator(value, this.data)) {
                this.errors.push({
                    field: rule.field,
                    message: rule.message
                });
            }
        });
        
        return this.errors.length === 0;
    }

    injectValidation(req, res, next) {
        req.validator = this;
        req.validate = (data) => this.validate(data || req.body);
        next();
    }

    getErrors() {
        return this.errors;
    }

    hasErrors() {
        return this.errors.length > 0;
    }

    clear() {
        this.errors = [];
        this.rules = [];
        this.data = {};
        return this;
    }
}