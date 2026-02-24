import { logger } from '$lib/utils/logger';
import type { ToolRecord } from '$lib/server/ai/tools/types';

const formatResult = (num: number): number => {
	return parseFloat(num.toPrecision(12));
};

const factorial = (n: number): number => {
	if (n < 0) throw new Error('Factorial is not defined for negative numbers');
	if (!Number.isInteger(n)) throw new Error('Factorial requires an integer');
	if (n === 0 || n === 1) return 1;
	let result = 1;
	for (let i = 2; i <= n; i++) result *= i;
	return result;
};

interface CalculationArgs {
	operation: string;
	a?: number;
	b?: number;
	angleUnit?: 'deg' | 'rad';
	value?: string;
	fromBase?: number;
	toBase?: number;
}

const executeSingleCalculation = (args: CalculationArgs) => {
	const { operation, a, b, angleUnit = 'deg', value, fromBase = 10, toBase = 10 } = args;

	if (operation !== 'convert_base' && typeof a !== 'number') {
		return { error: `Operation '${operation}' requires at least operand 'a'.` };
	}

	const getRadians = (val: number) => (angleUnit === 'deg' ? val * (Math.PI / 180) : val);
	const fromRadians = (val: number) => (angleUnit === 'deg' ? val * (180 / Math.PI) : val);

	switch (operation) {
		case 'add':
			return { result: formatResult(a! + (b ?? 0)) };
		case 'subtract':
			return { result: formatResult(a! - (b ?? 0)) };
		case 'multiply':
			return { result: formatResult(a! * (b ?? 1)) };
		case 'divide':
			if (b === 0) return { error: 'Division by zero is not allowed.' };
			return { result: formatResult(a! / (b ?? 1)) };
		case 'modulo':
			return { result: formatResult(a! % (b ?? 1)) };
		case 'power':
			return { result: formatResult(Math.pow(a!, b ?? 1)) };
		case 'root':
			if (b === undefined || b === 2) {
				if (a! < 0) return { error: 'Cannot calculate square root of a negative number.' };
				return { result: formatResult(Math.sqrt(a!)) };
			}
			if (a! < 0 && b! % 2 === 0)
				return { error: 'Cannot calculate even root of a negative number.' };
			return { result: formatResult(Math.pow(a!, 1 / b!)) };
		case 'factorial':
			return { result: factorial(a!) };
		case 'ln':
			if (a! <= 0) return { error: 'Logarithm requires positive argument.' };
			return { result: formatResult(Math.log(a!)) };
		case 'log': {
			if (a! <= 0) return { error: 'Logarithm requires positive argument.' };
			const base = b ?? 10;
			if (base <= 0 || base === 1) return { error: 'Logarithm base must be positive and not 1.' };
			return { result: formatResult(Math.log(a!) / Math.log(base)) };
		}
		case 'sin':
			return { result: formatResult(Math.sin(getRadians(a!))) };
		case 'cos':
			return { result: formatResult(Math.cos(getRadians(a!))) };
		case 'tan':
			if (angleUnit === 'deg' && Math.abs(a! % 180) === 90) {
				return { error: 'Tangent is undefined for 90° + k*180°.' };
			}
			return { result: formatResult(Math.tan(getRadians(a!))) };
		case 'asin':
			if (a! < -1 || a! > 1) return { error: 'Arcsin input must be between -1 and 1.' };
			return { result: formatResult(fromRadians(Math.asin(a!))) };
		case 'acos':
			if (a! < -1 || a! > 1) return { error: 'Arccos input must be between -1 and 1.' };
			return { result: formatResult(fromRadians(Math.acos(a!))) };
		case 'atan':
			return { result: formatResult(fromRadians(Math.atan(a!))) };
		case 'convert_base': {
			if (!value) return { error: 'Value to convert is required' };
			const cleanValue = value.replace(/^0x/i, '').replace(/^0b/i, '').replace(/^0o/i, '');
			const num = parseInt(cleanValue, fromBase);
			if (isNaN(num)) return { error: `Invalid input value '${value}' for base ${fromBase}` };
			return {
				result: num.toString(toBase).toUpperCase(),
				decimalValue: num,
				original: value,
				transformation: `Base ${fromBase} -> Base ${toBase}`
			};
		}
		default:
			return { error: `Unknown operation type: ${operation}` };
	}
};

export const calculatorTool: ToolRecord = {
	definition: {
		name: 'calculator',
		description:
			'Perform scientific mathematical calculations. Supports arithmetic, trigonometry, exponents, logarithms, and base conversion. Can perform multiple calculations in one call.',
		parameters: {
			type: 'object',
			properties: {
				calculations: {
					type: 'array',
					description: 'An array of calculations to perform.',
					items: {
						type: 'object',
						properties: {
							operation: {
								type: 'string',
								enum: [
									'add',
									'subtract',
									'multiply',
									'divide',
									'power',
									'root',
									'modulo',
									'factorial',
									'sin',
									'cos',
									'tan',
									'asin',
									'acos',
									'atan',
									'log',
									'ln',
									'convert_base'
								],
								description: 'The mathematical operation to perform.'
							},
							a: {
								type: 'number',
								description: 'Primary operand (e.g., base for power, angle for trig, or numerator).'
							},
							b: {
								type: 'number',
								description:
									'Secondary operand (e.g., exponent, divisor, or root degree). Optional for unary operations like sin/sqrt.'
							},
							angleUnit: {
								type: 'string',
								enum: ['deg', 'rad'],
								default: 'deg',
								description:
									'Unit for trigonometric operations (degrees or radians). Default is degrees.'
							},
							value: {
								type: 'string',
								description: 'String value to convert (strictly for base conversion).'
							},
							fromBase: { type: 'number', description: 'Source base (2-36)', default: 10 },
							toBase: { type: 'number', description: 'Target base (2-36)', default: 10 }
						},
						required: ['operation']
					}
				}
			},
			required: ['calculations']
		}
	},
	metadata: {
		tags: ['math', 'utility', 'scientific']
	},
	executor: async (args) => {
		const { calculations } = args as unknown as { calculations: CalculationArgs[] };

		if (!Array.isArray(calculations) || calculations.length === 0) {
			return { error: 'At least one calculation must be provided in the calculations array.' };
		}

		logger.debug(`[calculator] performing ${calculations.length} calculations`);

		try {
			const results = calculations.map((calc, index) => {
				try {
					return {
						index,
						...executeSingleCalculation(calc)
					};
				} catch (e: unknown) {
					const message = e instanceof Error ? e.message : String(e);
					return { index, error: message };
				}
			});

			return { results };
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			logger.error(`[calculator] error: ${message}`);
			return { error: `Batch calculation error: ${message}` };
		}
	}
};
