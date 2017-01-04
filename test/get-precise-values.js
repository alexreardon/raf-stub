import { expect } from 'chai';
import { it, describe } from 'mocha';
import { add, getPrecision } from '../src/get-precise-values';

describe('Get precise values', () => {
    describe('getPrecision', () => {
        it('should return 0 if the value has no decimal', () => {
            const values = [0, 10, -10];

            values.forEach(value => {
                expect(getPrecision(value)).to.eql(0);
            });
        });

        it('should return the length of the decimals', () => {
            const items = [
                {
                    value: 10.1,
                    expected: 1,
                },
                {
                    value: -10.11,
                    expected: 2,
                },
                {
                    value: 1000.1001,
                    expected: 4,
                },
            ];

            items.forEach(item => {
                expect(getPrecision(item.value)).to.eql(item.expected);
            });
        });
    });

    describe('add', () => {
        it('should return 0 when adding 0 and 0', () => {
            expect(add(0, 0)).to.eql(0);
        });

        it('should add integers together', () => {
            expect(add(1, 2)).to.eql(3);
        });

        it('should add small numbers with no precision issues', () => {
            expect(add(0.2, 0.2)).to.eql(0.4);
        });

        it('should add small numbers with precision issues', () => {
            expect(0.1 + 0.2).to.not.eql(0.3);
            expect(add(0.1, 0.2)).to.eql(0.3);
        });

        it('should add integers with decimals with precision issues', () => {
            expect(67.378003 + 57.378003).to.not.eql(124.756006);
            expect(add(67.378003, 57.378003)).to.eql(124.756006);
        });

        it('should add maintain the highest precision value', () => {
            expect(add(0.1, 0.02)).to.eql(0.12);
        });

        it('should add more than two values', () => {
            expect(0.1 + 0.2 + 0.4).to.not.eql(0.7);
            expect(add(0.1, 0.2, 0.4)).to.eql(0.7);
        });
    });
});