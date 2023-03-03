#!/usr/bin/env node
'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var os = _interopDefault(require('os'));
var tty = _interopDefault(require('tty'));

const flagSymbol = Symbol('arg flag');

function arg(opts, {argv = process.argv.slice(2), permissive = false, stopAtPositional = false} = {}) {
	if (!opts) {
		throw new Error('Argument specification object is required');
	}

	const result = {_: []};

	const aliases = {};
	const handlers = {};

	for (const key of Object.keys(opts)) {
		if (!key) {
			throw new TypeError('Argument key cannot be an empty string');
		}

		if (key[0] !== '-') {
			throw new TypeError(`Argument key must start with '-' but found: '${key}'`);
		}

		if (key.length === 1) {
			throw new TypeError(`Argument key must have a name; singular '-' keys are not allowed: ${key}`);
		}

		if (typeof opts[key] === 'string') {
			aliases[key] = opts[key];
			continue;
		}

		let type = opts[key];
		let isFlag = false;

		if (Array.isArray(type) && type.length === 1 && typeof type[0] === 'function') {
			const [fn] = type;
			type = (value, name, prev = []) => {
				prev.push(fn(value, name, prev[prev.length - 1]));
				return prev;
			};
			isFlag = fn === Boolean || fn[flagSymbol] === true;
		} else if (typeof type === 'function') {
			isFlag = type === Boolean || type[flagSymbol] === true;
		} else {
			throw new TypeError(`Type missing or not a function or valid array type: ${key}`);
		}

		if (key[1] !== '-' && key.length > 2) {
			throw new TypeError(`Short argument keys (with a single hyphen) must have only one character: ${key}`);
		}

		handlers[key] = [type, isFlag];
	}

	for (let i = 0, len = argv.length; i < len; i++) {
		const wholeArg = argv[i];

		if (stopAtPositional && result._.length > 0) {
			result._ = result._.concat(argv.slice(i));
			break;
		}

		if (wholeArg === '--') {
			result._ = result._.concat(argv.slice(i + 1));
			break;
		}

		if (wholeArg.length > 1 && wholeArg[0] === '-') {
			/* eslint-disable operator-linebreak */
			const separatedArguments = (wholeArg[1] === '-' || wholeArg.length === 2)
				? [wholeArg]
				: wholeArg.slice(1).split('').map(a => `-${a}`);
			/* eslint-enable operator-linebreak */

			for (let j = 0; j < separatedArguments.length; j++) {
				const arg = separatedArguments[j];
				const [originalArgName, argStr] = arg[1] === '-' ? arg.split(/=(.*)/, 2) : [arg, undefined];

				let argName = originalArgName;
				while (argName in aliases) {
					argName = aliases[argName];
				}

				if (!(argName in handlers)) {
					if (permissive) {
						result._.push(arg);
						continue;
					} else {
						const err = new Error(`Unknown or unexpected option: ${originalArgName}`);
						err.code = 'ARG_UNKNOWN_OPTION';
						throw err;
					}
				}

				const [type, isFlag] = handlers[argName];

				if (!isFlag && ((j + 1) < separatedArguments.length)) {
					throw new TypeError(`Option requires argument (but was followed by another short argument): ${originalArgName}`);
				}

				if (isFlag) {
					result[argName] = type(true, argName, result[argName]);
				} else if (argStr === undefined) {
					if (
						argv.length < i + 2 ||
						(
							argv[i + 1].length > 1 &&
							(argv[i + 1][0] === '-') &&
							!(
								argv[i + 1].match(/^-?\d*(\.(?=\d))?\d*$/) &&
								(
									type === Number ||
									// eslint-disable-next-line no-undef
									(typeof BigInt !== 'undefined' && type === BigInt)
								)
							)
						)
					) {
						const extended = originalArgName === argName ? '' : ` (alias for ${argName})`;
						throw new Error(`Option requires argument: ${originalArgName}${extended}`);
					}

					result[argName] = type(argv[i + 1], argName, result[argName]);
					++i;
				} else {
					result[argName] = type(argStr, argName, result[argName]);
				}
			}
		} else {
			result._.push(wholeArg);
		}
	}

	return result;
}

arg.flag = fn => {
	fn[flagSymbol] = true;
	return fn;
};

// Utility types
arg.COUNT = arg.flag((v, name, existingCount) => (existingCount || 0) + 1);

var arg_1 = arg;

class Token {
    constructor(value, type) {
        this._value = value;
        this._type = type;
        this._format = '';
    }
    get value() {
        return this._value;
    }
    set value(value) {
        this._value = value;
    }
    get type() {
        return this._type;
    }
    set type(type) {
        this._type = type;
    }
    get format() {
        return this._format;
    }
    set format(format) {
        this._format = format;
    }
}

class Parser {
    constructor(name, pattern) {
        this.name = name;
        this.pattern = pattern;
    }
    parse(date) {
        const match = this.pattern.exec(date);
        if (!match || !match.groups) {
            return;
        }
        let tokens = [];
        for (const [key, val] of Object.entries(match.groups)) {
            if (val) {
                tokens.push(new Token(val, /delim\d+/.test(key) ? 'delimiter' : key));
            }
        }
        return {
            tokens: tokens,
            index: match.index,
            parser: this.name,
        };
    }
}

const abbreviatedTimezones = 'UT|'
    + 'CAT|CET|CVT|EAT|EET|GMT|MUT|RET|SAST|SCT|WAST|WAT|WEST|WET|WST|WT|'
    + 'ADT|AFT|ALMT|AMST|AMT|ANAST|ANAT|AQTT|AST|AZST|AZT|BNT|BST|BTT|CHOST|CHOT|'
    + 'CST|EEST|EET|GET|GST|HKT|HOVST|HOVT|ICT|IDT|IRDT|IRKST|IRKT|IST|JST|KGT|KRAST|'
    + 'KRAT|KST|MAGST|MAGT|MMT|MSK|MVT|NOVST|NOVT|NPT|OMSST|OMST|ORAT|PETST|PETT|PHT|'
    + 'PKT|PYT|QYZT|SAKT|SGT|SRET|TJT|TLT|TMT|TRT|ULAST|ULAT|UZT|VLAST|VLAT|WIB|WIT|'
    + 'YAKST|YAKT|YEKST|YEKT|'
    + 'ART|CAST|CEST|CLST|CLT|DAVT|DDUT|GMT|MAWT|NZDT|NZST|ROTT|SYOT|VOST|'
    + 'ADT|AST|AT|AZOST|AZOT|'
    + 'ACDT|ACST|ACT|ACWST|AEDT|AEST|AET|AWDT|AWST|CXT|LHDT|LHST|NFDT|NFT|'
    + 'AST|AT|CDT|CIDST|CIST|CST|EDT|EST|ET|'
    + 'CST|CT|EST|ET|'
    + 'BST|CEST|CET|EEST|EET|FET|GET|GMT|IST|KUYT|MSD|MSK|SAMT|TRT|WEST|WET|'
    + 'CCT|EAT|IOT|TFT|'
    + 'ADT|AKDT|AKST|AST|AT|CDT|CST|CT|EDT|EGST|EGT|ET|GMT|HDT|HST|MDT|MST|MT|NDT|NST|PDT|PMDT|PMST|PST|PT|WGST|WGT|'
    + 'AoE|BST|CHADT|CHAST|CHUT|CKT|ChST|EASST|EAST|FJST|FJT|GALT|GAMT|GILT|HST|KOST|LINT|MART|'
    + 'MHT|NCT|NRT|NUT|NZDT|NZST|PGT|PHOT|PONT|PST|PWT|SBT|SST|TAHT|TKT|TOST|TOT|TVT|VUT|WAKT|WFT|WST|YAPT|'
    + 'ACT|AMST|AMT|ART|BOT|BRST|BRT|CLST|CLT|COT|ECT|FKST|FKT|FNT|GFT|GST|GYT|PET|PYST|PYT|SRT|UYST|UYT|VET|WARST';
const dayOfMonthAndMonthNameDateFormatParser = new Parser('DayOfMonthAndMonthNameDateFormatParser', new RegExp('^'
    + '(?<dayOfWeek>(?:Sun?|Mon?|Tu(?:es)?|We(?:dnes)?|Th(?:urs)?|Fri?|Sa(?:tur)?)(?:day)?)?'
    + '(?<delim1>,)?'
    + '(?<delim2>\\s)?'
    + '(?<dayOfMonth>(?:3[0-1]|[1-2]\\d|0?[1-9])(?:st|nd|rd|th)?)'
    + '(?<delim3>\\s)'
    + '(?<month>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?'
    + '|'
    + 'July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
    + '(?<delim4>,)?'
    + '(?<delim5>\\s)?'
    + '(?<year>\\d{4}|\\d{2})?'
    + '(?:'
    + '(?<delim6>,)?'
    + '(?<delim7>\\s)'
    + '(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))'
    + '(?:'
    + '(?<delim8>[:.])'
    + '(?<minute>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim9>[:.])'
    + '(?<second>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim10>.)'
    + '(?<millisecond>\\d{3})'
    + ')?'
    + '(?<delim11>\\s)?'
    + '(?<meridiem>am|pm|AM|PM)?'
    + '(?:'
    + '(?<delim12>\\s)'
    + `(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones})`
    + ')?'
    + ')?'
    + '$'));
const iSO8601BasicDateTimeFormatParser = new Parser('ISO8601BasicDateTimeFormatParser', new RegExp('^'
    + '(?<year>[+-]\\d{6}|\\d{4})'
    + '(?:'
    + '(?<month>\\d{2})(?:(?<dayOfMonth>\\d{2}))?'
    + '|'
    + '(?<escapeText>W)(?<isoWeekOfYear>\\d{2})(?:(?<isoDayOfWeek>\\d))?'
    + '|'
    + '(?<dayOfYear>\\d{3})'
    + ')?'
    + '(?:'
    + '(?<delim1>T| )'
    + '(?:(?<twentyFourHour>\\d{2})(?:(?<minute>\\d{2})(?:(?<second>\\d{2})(?:(?<delim2>[.,])(?<millisecond>\\d{1,9}))?)?)?)'
    + '(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z)?'
    + ')?'
    + '$'));
const iSO8601ExtendedDateTimeFormatParser = new Parser('ISO8601ExtendedDateTimeFormatParser', new RegExp('^'
    + '(?<year>[+-]\\d{6}|\\d{4})'
    + '(?<delim1>\\-)'
    + '(?:'
    + '(?<month>\\d{2})(?:(?<delim2>\\-)(?<dayOfMonth>\\d{2}))?'
    + '|'
    + '(?<escapeText>W)(?<isoWeekOfYear>\\d{2})(?:(?<delim3>\\-)(?<isoDayOfWeek>\\d))?'
    + '|'
    + '(?<dayOfYear>\\d{3})'
    + ')'
    + '(?:'
    + '(?<delim4>T| )'
    + '(?:(?<twentyFourHour>\\d{2})(?:(?<delim5>:)(?<minute>\\d{2})(?:(?<delim6>:)(?<second>\\d{2})(?:(?<delim7>[.,])(?<millisecond>\\d{1,9}))?)?)?)'
    + '(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z)?'
    + ')?'
    + '$'));
const monthNameAndDayOfMonthDateFormatParser = new Parser('MonthNameAndDayOfMonthDateFormatParser', new RegExp('^'
    + '(?<dayOfWeek>(?:Sun?|Mon?|Tu(?:es)?|We(?:dnes)?|Th(?:urs)?|Fri?|Sa(?:tur)?)(?:day)?)?'
    + '(?<delim1>,)?'
    + '(?<delim2>\\s)?'
    + '(?<month>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?'
    + '|'
    + 'July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
    + '(?<delim3>\\s)'
    + '(?<dayOfMonth>(?:3[0-1]|[1-2]\\d|0?[1-9])(?:st|nd|rd|th)?)'
    + '(?<delim4>,)?'
    + '(?<delim5>\\s)?'
    + '(?<year>\\d{4}|\\d{2})?'
    + '(?:'
    + '(?:'
    + '(?<delim6>,)?'
    + '(?<delim7>\\s)'
    + '(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))'
    + '(?:'
    + '(?<delim8>[:.])'
    + '(?<minute>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim9>[:.])'
    + '(?<second>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim10>.)'
    + '(?<millisecond>\\d{3})'
    + ')?'
    + '(?<delim11>\\s)?'
    + '(?<meridiem>am|pm|AM|PM)?'
    + '(?:'
    + '(?<delim12>\\s)'
    + `(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones})`
    + ')?'
    + ')?'
    + ')?'
    + '$'));
const rFC2822DateTimeFormatParser = new Parser('RFC2822DateTimeFormatParser', new RegExp('^'
    + '(?:(?<dayOfWeek>Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?<delim1>,)?(?<delim2>\\s))?'
    + '(?<dayOfMonth>\\d{1,2})(?<delim3>\\s)(?<month>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?<delim4>\\s)(?<year>\\d{2,4})'
    + '(?<delim5>\\s)'
    + '(?<twentyFourHour>\\d{2})(?<delim6>:)(?<minute>\\d{2})(?:(?<delim7>:)(?<second>\\d{2}))?'
    + '(?<delim8>\\s)'
    + '(?<timezone>(?:(?:UT|GMT|[ECMP][SD]T)|[Zz]|[+-]\\d{4}))'
    + '$'));
const slashDelimitedDateTimeFormatParser = new Parser('SlashDelimitedDateFormatParser', new RegExp('^'
    + '(?<year>\\d{4}|\\d{2})'
    + '(?<delim1>[/.-])'
    + '(?<month>0?[1-9]|1[0-2])'
    + '(?:'
    + '(?<delim2>[/.-])'
    + '(?<dayOfMonth>0?[1-9]|[1-2]\\d|3[0-1])'
    + ')?'
    + '(?:'
    + '(?:'
    + '(?<delim3>,)?'
    + '(?<delim4>\\s)'
    + '(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))'
    + '(?:'
    + '(?<delim5>[:.])'
    + '(?<minute>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim6>[:.])'
    + '(?<second>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim7>.)'
    + '(?<millisecond>\\d{3})'
    + ')?'
    + '(?<delim8>\\s)?'
    + '(?<meridiem>am|pm|AM|PM)?'
    + '(?:'
    + '(?<delim9>\\s)'
    + `(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones})`
    + ')?'
    + ')?'
    + ')?'
    + '$'));
const twelveHourTimeFormatParser = new Parser('TwelveHourTimeFormatParser', new RegExp('^'
    + '(?<twelveHour>0?[1-9]|1[0-2])'
    + '(?:'
    + '(?<delim1>[:.])'
    + '(?<minute>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim2>[:.])'
    + '(?<second>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim3>.)'
    + '(?<millisecond>\\d{3})'
    + ')?'
    + '(?<delim4>\\s)?'
    + '(?<meridiem>am|pm|AM|PM)'
    + '(?:'
    + '(?<delim5>\\s)'
    + `(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones})`
    + ')?'
    + '$'));
const twentyFourHourTimeFormatParser = new Parser('TwentyFourHourTimeFormatParser', new RegExp('^'
    + '(?<twentyFourHour>2[0-3]|0?\\d|1\\d)'
    + '(?<delim1>[:.])'
    + '(?<minute>[0-5]\\d)'
    + '(?:'
    + '(?<delim2>[:.])'
    + '(?<second>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim3>.)'
    + '(?<millisecond>\\d{3})'
    + ')?'
    + '(?:'
    + '(?<delim4>\\s)'
    + `(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones})`
    + ')?'
    + '$'));
const uKStyleSlashDelimitedDateTimeFormatParser = new Parser('UKStyleSlashDelimitedDateFormatParser', new RegExp('^'
    + '(?<dayOfMonth>0?[1-9]|[1-2]\\d|3[0-1])'
    + '(?<delim1>[/.-])'
    + '(?<month>0?[1-9]|1[0-2])'
    + '(?:'
    + '(?<delim2>[/.-])'
    + '(?<year>\\d{4}|\\d{2})'
    + ')?'
    + '(?:'
    + '(?:'
    + '(?<delim3>,)?'
    + '(?<delim4>\\s)'
    + '(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))'
    + '(?:'
    + '(?<delim5>[:.])'
    + '(?<minute>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim6>[:.])'
    + '(?<second>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim7>.)'
    + '(?<millisecond>\\d{3})'
    + ')?'
    + '(?<delim8>\\s)?'
    + '(?<meridiem>am|pm|AM|PM)?'
    + '(?:'
    + '(?<delim9>\\s)'
    + `(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones})`
    + ')?'
    + ')?'
    + ')?'
    + '$'));
const uSStyleSlashDelimitedDateTimeFormatParser = new Parser('USStyleSlashDelimitedDateFormatParser', new RegExp('^'
    + '(?<month>0?[1-9]|1[0-2])'
    + '(?<delim1>[/.-])'
    + '(?<dayOfMonth>0?[1-9]|[1-2]\\d|3[0-1])'
    + '(?:'
    + '(?<delim2>[/.-])'
    + '(?<year>\\d{4}|\\d{2})'
    + ')?'
    + '(?:'
    + '(?:'
    + '(?<delim3>,)?'
    + '(?<delim4>\\s)'
    + '(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))'
    + '(?:'
    + '(?<delim5>[:.])'
    + '(?<minute>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim6>[:.])'
    + '(?<second>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim7>.)'
    + '(?<millisecond>\\d{3})'
    + ')?'
    + '(?<delim8>\\s)?'
    + '(?<meridiem>am|pm|AM|PM)?'
    + '(?:'
    + '(?<delim9>\\s)'
    + `(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones})`
    + ')?'
    + ')?'
    + ')?'
    + '$'));
const dashDelimitedWithMonthNameDateTimeFormatParser = new Parser('DashDelimitedWithMonthNameDateTimeFormatParser', new RegExp('^'
    + '(?<dayOfMonth>0?[1-9]|[1-2]\\d|3[0-1])'
    + '(?<delim1>-)'
    + '(?<month>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?'
    + '|'
    + 'July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
    + '(?<delim2>-)?'
    + '(?<year>\\d{4}|\\d{2})?'
    + '(?:'
    + '(?:'
    + '(?<delim3>,)?'
    + '(?<delim4>\\s)'
    + '(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))'
    + '(?:'
    + '(?<delim5>[:.])'
    + '(?<minute>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim6>[:.])'
    + '(?<second>[0-5]\\d)'
    + ')?'
    + '(?:'
    + '(?<delim7>.)'
    + '(?<millisecond>\\d{3})'
    + ')?'
    + '(?<delim8>\\s)?'
    + '(?<meridiem>am|pm|AM|PM)?'
    + '(?:'
    + '(?<delim9>\\s)'
    + `(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones})`
    + ')?'
    + ')?'
    + ')?'
    + '$'));
const parsers = [
    iSO8601ExtendedDateTimeFormatParser,
    iSO8601BasicDateTimeFormatParser,
    rFC2822DateTimeFormatParser,
    slashDelimitedDateTimeFormatParser,
    uKStyleSlashDelimitedDateTimeFormatParser,
    uSStyleSlashDelimitedDateTimeFormatParser,
    monthNameAndDayOfMonthDateFormatParser,
    dayOfMonthAndMonthNameDateFormatParser,
    twentyFourHourTimeFormatParser,
    twelveHourTimeFormatParser,
    dashDelimitedWithMonthNameDateTimeFormatParser,
];

class StandardFormatParsersRefiner {
    constructor(name) {
        this.name = name;
    }
    refine(parsedResults) {
        const res = parsedResults.filter(r => {
            return r.parser === 'ISO8601ExtendedDateTimeFormatParser' ||
                r.parser === 'ISO8601BasicDateTimeFormatParser' ||
                r.parser === 'RFC2822DateTimeFormatParser';
        });
        if (res.length === 0) {
            return parsedResults;
        }
        return res;
    }
}

class TimeFormatRefiner {
    constructor(name) {
        this.name = name;
    }
    refine(parsedResults) {
        parsedResults.forEach(r => {
            let meridiemExists = false;
            r.tokens.forEach(t => {
                if (t.type === 'meridiem') {
                    meridiemExists = true;
                }
            });
            if (meridiemExists) {
                r.tokens.forEach(t => {
                    if (t.type === 'twentyFourHour') {
                        t.type = 'twelveHour';
                    }
                });
            }
        });
        return parsedResults;
    }
}

const timeFormatRefiner = new TimeFormatRefiner('TimeFormatRefiner');
const standardFormatParsersRefiner = new StandardFormatParsersRefiner('StandardFormatParsersRefiner');
const refiners = [
    standardFormatParsersRefiner,
    timeFormatRefiner,
];

class YearFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/\d{2}/, 'YY');
            this._map.set(/\d{4}/, 'YYYY');
            this._map.set(/[+-]\d{6}/, 'YYYYYY');
        }
        else {
            this._map.set(/\d{2}/, '%y');
            this._map.set(/\d{4}/, '%Y');
            this._map.set(/[+-]\d{6}/, 'NA');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class MonthFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/\d{1,2}/, 'M');
            this._map.set(/\d{2}/, 'MM');
            this._map.set(/\d{1,2}(?:st|nd|rd|th)/, 'Mo');
            this._map.set(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, 'MMM');
            this._map.set(/^(January|February|March|April|May|June|July|August|September|October|November|December)$/, 'MMMM');
        }
        else {
            this._map.set(/\d{1,2}/, 'NA');
            this._map.set(/\d{2}/, '%m');
            this._map.set(/\d{1,2}(?:st|nd|rd|th)/, 'NA');
            this._map.set(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, '%b');
            this._map.set(/^(January|February|March|April|May|June|July|August|September|October|November|December)$/, '%B');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class DayOfMonthFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/\d{1,2}/, 'D');
            this._map.set(/\d{2}/, 'DD');
            this._map.set(/\d{1,2}(?:st|nd|rd|th)/, 'Do');
        }
        else {
            this._map.set(/\d{1,2}/, '%-e');
            this._map.set(/\d{2}/, '%d');
            this._map.set(/\d{1,2}(?:st|nd|rd|th)/, '%o');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class DelimiterFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.format = format;
        this.type = type;
    }
    assign(token) { }
}

class MinuteFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/\d{1,2}/, 'm');
            this._map.set(/\d{2}/, 'mm');
        }
        else {
            this._map.set(/\d{1,2}/, 'NA');
            this._map.set(/\d{2}/, '%M');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class SecondFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/\d{1,2}/, 's');
            this._map.set(/\d{2}/, 'ss');
        }
        else {
            this._map.set(/\d{1,2}/, 'NA');
            this._map.set(/\d{2}/, '%S');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class MillisecondFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/\d/, 'S');
            this._map.set(/\d{2}/, 'SS');
            this._map.set(/\d{3}/, 'SSS');
        }
        else {
            this._map.set(/\d/, 'NA');
            this._map.set(/\d{2}/, 'NA');
            this._map.set(/\d{3}/, '%L');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class TimezoneFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        const abbreviatedTimezoneRegex = new RegExp('UT|'
            + 'CAT|CET|CVT|EAT|EET|GMT|MUT|RET|SAST|SCT|WAST|WAT|WEST|WET|WST|WT|'
            + 'ADT|AFT|ALMT|AMST|AMT|ANAST|ANAT|AQTT|AST|AZST|AZT|BNT|BST|BTT|CHOST|CHOT|'
            + 'CST|EEST|EET|GET|GST|HKT|HOVST|HOVT|ICT|IDT|IRDT|IRKST|IRKT|IST|JST|KGT|KRAST|'
            + 'KRAT|KST|MAGST|MAGT|MMT|MSK|MVT|NOVST|NOVT|NPT|OMSST|OMST|ORAT|PETST|PETT|PHT|'
            + 'PKT|PYT|QYZT|SAKT|SGT|SRET|TJT|TLT|TMT|TRT|ULAST|ULAT|UZT|VLAST|VLAT|WIB|WIT|'
            + 'YAKST|YAKT|YEKST|YEKT|'
            + 'ART|CAST|CEST|CLST|CLT|DAVT|DDUT|GMT|MAWT|NZDT|NZST|ROTT|SYOT|VOST|'
            + 'ADT|AST|AT|AZOST|AZOT|'
            + 'ACDT|ACST|ACT|ACWST|AEDT|AEST|AET|AWDT|AWST|CXT|LHDT|LHST|NFDT|NFT|'
            + 'AST|AT|CDT|CIDST|CIST|CST|EDT|EST|ET|'
            + 'CST|CT|EST|ET|'
            + 'BST|CEST|CET|EEST|EET|FET|GET|GMT|IST|KUYT|MSD|MSK|SAMT|TRT|WEST|WET|'
            + 'CCT|EAT|IOT|TFT|'
            + 'ADT|AKDT|AKST|AST|AT|CDT|CST|CT|EDT|EGST|EGT|ET|GMT|HDT|HST|MDT|MST|MT|NDT|NST|PDT|PMDT|PMST|PST|PT|WGST|WGT|'
            + 'AoE|BST|CHADT|CHAST|CHUT|CKT|ChST|EASST|EAST|FJST|FJT|GALT|GAMT|GILT|HST|KOST|LINT|MART|'
            + 'MHT|NCT|NRT|NUT|NZDT|NZST|PGT|PHOT|PONT|PST|PWT|SBT|SST|TAHT|TKT|TOST|TOT|TVT|VUT|WAKT|WFT|WST|YAPT|'
            + 'ACT|AMST|AMT|ART|BOT|BRST|BRT|CLST|CLT|COT|ECT|FKST|FKT|FNT|GFT|GST|GYT|PET|PYST|PYT|SRT|UYST|UYT|VET|WARST');
        if (!format || format === 'default') {
            this._map.set(/[+-]\d{2}(?::\d{2})?/, 'Z');
            this._map.set(/[+-]\d{4}/, 'ZZ');
            this._map.set(/Z/, '[Z]');
            this._map.set(/z/, '[z]');
            this._map.set(abbreviatedTimezoneRegex, 'z');
        }
        else {
            this._map.set(/[+-]\d{2}(?::\d{2})?/, '%:z');
            this._map.set(/[+-]\d{4}/, '%z');
            this._map.set(/Z/, 'Z');
            this._map.set(/z/, 'z');
            this._map.set(abbreviatedTimezoneRegex, '%Z');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class DayOfYearFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/\d{1,3}/, 'DDD');
            this._map.set(/\d{3}/, 'DDDD');
            this._map.set(/\d{1,3}(?:st|nd|rd|th)/, 'DDDo');
        }
        else {
            this._map.set(/\d{1,3}/, 'NA');
            this._map.set(/\d{3}/, '%j');
            this._map.set(/\d{1,3}(?:st|nd|rd|th)/, 'NA');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class EscapeTextFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        if (this._testTokenType(token)) {
            token.format = (!this.format || this.format === 'default') ? `[${token.value}]` : token.value;
        }
    }
}

class ISODayOfWeekFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/[1-7]/, 'E');
        }
        else {
            this._map.set(/[1-7]/, '%u');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class ISOWeekOfYearFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/\d{1,2}/, 'W');
            this._map.set(/\d{2}/, 'WW');
            this._map.set(/\d{1,2}(?:st|nd|rd|th)/, 'Wo');
        }
        else {
            this._map.set(/\d{1,2}/, 'NA');
            this._map.set(/\d{2}/, '%U');
            this._map.set(/\d{1,2}(?:st|nd|rd|th)/, 'NA');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class TwentyFourHourFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/^(\d|1\d|2[0-3])$/, 'H');
            this._map.set(/^([0-1]\d|2[0-3])$/, 'HH');
        }
        else {
            this._map.set(/^(\d|1\d|2[0-3])$/, '%-k');
            this._map.set(/^([0-1]\d|2[0-3])$/, '%H');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class TwelveHourFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/^([1-9]|1[0-2])$/, 'h');
            this._map.set(/^(0\d|1[0-2])$/, 'hh');
        }
        else {
            this._map.set(/^([1-9]|1[0-2])$/, '%-l');
            this._map.set(/^(0\d|1[0-2])$/, '%I');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class DayOfWeekFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/[0-6]/, 'd');
            this._map.set(/[0-6](?:st|nd|rd|th)/, 'do');
            this._map.set(/(?:Su|Mo|Tu|We|Th|Fr|Sa)/, 'dd');
            this._map.set(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)/, 'ddd');
            this._map.set(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/, 'dddd');
        }
        else {
            this._map.set(/[0-6]/, '%w');
            this._map.set(/[0-6](?:st|nd|rd|th)/, 'NA');
            this._map.set(/(?:Su|Mo|Tu|We|Th|Fr|Sa)/, 'NA');
            this._map.set(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)/, '%a');
            this._map.set(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/, '%A');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

class MeridiemFormatTokenAssigner {
    constructor(name, type, format) {
        this.name = name;
        this.type = type;
        this.format = format;
        this._map = new Map();
        if (!format || format === 'default') {
            this._map.set(/am|pm/, 'a');
            this._map.set(/AM|PM/, 'A');
        }
        else {
            this._map.set(/am|pm/, '%P');
            this._map.set(/AM|PM/, '%p');
        }
    }
    _testTokenType(token) {
        return token.type === this.type;
    }
    assign(token) {
        this._map.forEach((formatToken, pattern) => {
            if (this._testTokenType(token) && pattern.test(token.value)) {
                token.format = formatToken;
            }
        });
    }
}

const dayOfMonthFormatTokenAssigner = new DayOfMonthFormatTokenAssigner('DelimiterFormatTokenAssigner', 'dayOfMonth');
const dayOfWeekFormatTokenAssigner = new DayOfWeekFormatTokenAssigner('DayOfWeekFormatTokenAssigner', 'dayOfWeek');
const dayOfYearFormatTokenAssigner = new DayOfYearFormatTokenAssigner('DayOfYearFormatTokenAssigner', 'dayOfYear');
const delimiterFormatTokenAssigner = new DelimiterFormatTokenAssigner('DelimiterFormatTokenAssigner', 'delimiter');
const escapeTextFormatTokenAssigner = new EscapeTextFormatTokenAssigner('EscapeTextFormatTokenAssigner', 'escapeText');
const iSODayOfWeekFormatTokenAssigner = new ISODayOfWeekFormatTokenAssigner('ISODayOfWeekFormatTokenAssigner', 'isoDayOfWeek');
const iSOWeekOfYearFormatTokenAssigner = new ISOWeekOfYearFormatTokenAssigner('ISOWeekOfYearFormatTokenAssigner', 'isoWeekOfYear');
const meridiemFormatTokenAssigner = new MeridiemFormatTokenAssigner('MeridiemFormatTokenAssigner', 'meridiem');
const millisecondFormatTokenAssigner = new MillisecondFormatTokenAssigner('MillisecondFormatTokenAssigner', 'millisecond');
const minuteFormatTokenAssigner = new MinuteFormatTokenAssigner('MinuteFormatTokenAssigner', 'minute');
const monthFormatTokenAssigner = new MonthFormatTokenAssigner('MonthFormatTokenAssigner', 'month');
const secondFormatTokenAssigner = new SecondFormatTokenAssigner('SecondFormatTokenAssigner', 'second');
const timezoneFormatTokenAssigner = new TimezoneFormatTokenAssigner('TimezoneFormatTokenAssigner', 'timezone');
const twelveHourFormatTokenAssigner = new TwelveHourFormatTokenAssigner('TwelveHourFormatTokenAssigner', 'twelveHour');
const twentyFourHourFormatTokenAssigner = new TwentyFourHourFormatTokenAssigner('TwentyFourHourFormatTokenAssigner', 'twentyFourHour');
const yearFormatTokenAssigner = new YearFormatTokenAssigner('YearFormatTokenAssigner', 'year');
const strftimeDayOfMonthFormatTokenAssigner = new DayOfMonthFormatTokenAssigner('DelimiterFormatTokenAssigner', 'dayOfMonth', 'strftime');
const strftimeDayOfWeekFormatTokenAssigner = new DayOfWeekFormatTokenAssigner('DayOfWeekFormatTokenAssigner', 'dayOfWeek', 'strftime');
const strftimeDayOfYearFormatTokenAssigner = new DayOfYearFormatTokenAssigner('DayOfYearFormatTokenAssigner', 'dayOfYear', 'strftime');
const strftimeDelimiterFormatTokenAssigner = new DelimiterFormatTokenAssigner('DelimiterFormatTokenAssigner', 'delimiter', 'strftime');
const strftimeEscapeTextFormatTokenAssigner = new EscapeTextFormatTokenAssigner('EscapeTextFormatTokenAssigner', 'escapeText', 'strftime');
const strftimeISODayOfWeekFormatTokenAssigner = new ISODayOfWeekFormatTokenAssigner('ISODayOfWeekFormatTokenAssigner', 'isoDayOfWeek', 'strftime');
const strftimeISOWeekOfYearFormatTokenAssigner = new ISOWeekOfYearFormatTokenAssigner('ISOWeekOfYearFormatTokenAssigner', 'isoWeekOfYear', 'strftime');
const strftimeMeridiemFormatTokenAssigner = new MeridiemFormatTokenAssigner('MeridiemFormatTokenAssigner', 'meridiem', 'strftime');
const strftimeMillisecondFormatTokenAssigner = new MillisecondFormatTokenAssigner('MillisecondFormatTokenAssigner', 'millisecond', 'strftime');
const strftimeMinuteFormatTokenAssigner = new MinuteFormatTokenAssigner('MinuteFormatTokenAssigner', 'minute', 'strftime');
const strftimeMonthFormatTokenAssigner = new MonthFormatTokenAssigner('MonthFormatTokenAssigner', 'month', 'strftime');
const strftimeSecondFormatTokenAssigner = new SecondFormatTokenAssigner('SecondFormatTokenAssigner', 'second', 'strftime');
const strftimeTimezoneFormatTokenAssigner = new TimezoneFormatTokenAssigner('TimezoneFormatTokenAssigner', 'timezone', 'strftime');
const strftimeTwelveHourFormatTokenAssigner = new TwelveHourFormatTokenAssigner('TwelveHourFormatTokenAssigner', 'twelveHour', 'strftime');
const strftimeTwentyFourHourFormatTokenAssigner = new TwentyFourHourFormatTokenAssigner('TwentyFourHourFormatTokenAssigner', 'twentyFourHour', 'strftime');
const strftimeYearFormatTokenAssigner = new YearFormatTokenAssigner('YearFormatTokenAssigner', 'year', 'strftime');
const defaultAssigners = [
    yearFormatTokenAssigner,
    monthFormatTokenAssigner,
    dayOfMonthFormatTokenAssigner,
    delimiterFormatTokenAssigner,
    minuteFormatTokenAssigner,
    secondFormatTokenAssigner,
    millisecondFormatTokenAssigner,
    timezoneFormatTokenAssigner,
    dayOfYearFormatTokenAssigner,
    escapeTextFormatTokenAssigner,
    iSODayOfWeekFormatTokenAssigner,
    iSOWeekOfYearFormatTokenAssigner,
    twentyFourHourFormatTokenAssigner,
    twelveHourFormatTokenAssigner,
    dayOfWeekFormatTokenAssigner,
    meridiemFormatTokenAssigner,
];
const strftimeAssigners = [
    strftimeDayOfMonthFormatTokenAssigner,
    strftimeDayOfWeekFormatTokenAssigner,
    strftimeDayOfYearFormatTokenAssigner,
    strftimeDelimiterFormatTokenAssigner,
    strftimeEscapeTextFormatTokenAssigner,
    strftimeISODayOfWeekFormatTokenAssigner,
    strftimeISOWeekOfYearFormatTokenAssigner,
    strftimeMeridiemFormatTokenAssigner,
    strftimeMillisecondFormatTokenAssigner,
    strftimeMinuteFormatTokenAssigner,
    strftimeMonthFormatTokenAssigner,
    strftimeSecondFormatTokenAssigner,
    strftimeTimezoneFormatTokenAssigner,
    strftimeTwelveHourFormatTokenAssigner,
    strftimeTwentyFourHourFormatTokenAssigner,
    strftimeYearFormatTokenAssigner,
];

class Guesser {
    constructor() { }
    static parse(date) {
        const parsedResults = [];
        parsers.forEach(parser => {
            const parsedResult = parser.parse(date);
            if (parsedResult) {
                parsedResults.push(Object.assign({}, parsedResult));
            }
        });
        return parsedResults;
    }
    static refine(parsedResults) {
        let refinedParsedResults = [...parsedResults];
        refiners.forEach(refiner => {
            refinedParsedResults = [
                ...refiner.refine(refinedParsedResults)
            ];
        });
        return refinedParsedResults;
    }
    static assign(tokens, format) {
        let assigners = (!format || format === 'default') ? defaultAssigners : strftimeAssigners;
        assigners.forEach(assigner => {
            tokens.forEach(token => {
                assigner.assign(token);
            });
        });
    }
    static getFormatString(tokens) {
        let formatString = '';
        tokens.forEach(token => {
            if (token.format === 'NA') {
                throw Error(`Couldn't find strftime modifier for "${token.value}"`);
            }
            formatString += token.format ? token.format : token.value;
        });
        return formatString;
    }
}

function guessFormat(date, format) {
    const parsedResults = Guesser.parse(date);
    const refinedParsedResults = Guesser.refine(parsedResults);
    if (refinedParsedResults.length === 0) {
        throw Error("Couldn't parse date");
    }
    refinedParsedResults.forEach(r => Guesser.assign(r.tokens, format));
    let matchedFormats = [];
    refinedParsedResults.forEach(r => matchedFormats.push(Guesser.getFormatString(r.tokens)));
    return (matchedFormats.length === 1
        ? matchedFormats[0]
        : matchedFormats);
}

function createCommonjsModule(fn, basedir, module) {
	return module = {
	  path: basedir,
	  exports: {},
	  require: function (path, base) {
      return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    }
	}, fn(module, module.exports), module.exports;
}

function commonjsRequire () {
	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
}

var colorName = {
	"aliceblue": [240, 248, 255],
	"antiquewhite": [250, 235, 215],
	"aqua": [0, 255, 255],
	"aquamarine": [127, 255, 212],
	"azure": [240, 255, 255],
	"beige": [245, 245, 220],
	"bisque": [255, 228, 196],
	"black": [0, 0, 0],
	"blanchedalmond": [255, 235, 205],
	"blue": [0, 0, 255],
	"blueviolet": [138, 43, 226],
	"brown": [165, 42, 42],
	"burlywood": [222, 184, 135],
	"cadetblue": [95, 158, 160],
	"chartreuse": [127, 255, 0],
	"chocolate": [210, 105, 30],
	"coral": [255, 127, 80],
	"cornflowerblue": [100, 149, 237],
	"cornsilk": [255, 248, 220],
	"crimson": [220, 20, 60],
	"cyan": [0, 255, 255],
	"darkblue": [0, 0, 139],
	"darkcyan": [0, 139, 139],
	"darkgoldenrod": [184, 134, 11],
	"darkgray": [169, 169, 169],
	"darkgreen": [0, 100, 0],
	"darkgrey": [169, 169, 169],
	"darkkhaki": [189, 183, 107],
	"darkmagenta": [139, 0, 139],
	"darkolivegreen": [85, 107, 47],
	"darkorange": [255, 140, 0],
	"darkorchid": [153, 50, 204],
	"darkred": [139, 0, 0],
	"darksalmon": [233, 150, 122],
	"darkseagreen": [143, 188, 143],
	"darkslateblue": [72, 61, 139],
	"darkslategray": [47, 79, 79],
	"darkslategrey": [47, 79, 79],
	"darkturquoise": [0, 206, 209],
	"darkviolet": [148, 0, 211],
	"deeppink": [255, 20, 147],
	"deepskyblue": [0, 191, 255],
	"dimgray": [105, 105, 105],
	"dimgrey": [105, 105, 105],
	"dodgerblue": [30, 144, 255],
	"firebrick": [178, 34, 34],
	"floralwhite": [255, 250, 240],
	"forestgreen": [34, 139, 34],
	"fuchsia": [255, 0, 255],
	"gainsboro": [220, 220, 220],
	"ghostwhite": [248, 248, 255],
	"gold": [255, 215, 0],
	"goldenrod": [218, 165, 32],
	"gray": [128, 128, 128],
	"green": [0, 128, 0],
	"greenyellow": [173, 255, 47],
	"grey": [128, 128, 128],
	"honeydew": [240, 255, 240],
	"hotpink": [255, 105, 180],
	"indianred": [205, 92, 92],
	"indigo": [75, 0, 130],
	"ivory": [255, 255, 240],
	"khaki": [240, 230, 140],
	"lavender": [230, 230, 250],
	"lavenderblush": [255, 240, 245],
	"lawngreen": [124, 252, 0],
	"lemonchiffon": [255, 250, 205],
	"lightblue": [173, 216, 230],
	"lightcoral": [240, 128, 128],
	"lightcyan": [224, 255, 255],
	"lightgoldenrodyellow": [250, 250, 210],
	"lightgray": [211, 211, 211],
	"lightgreen": [144, 238, 144],
	"lightgrey": [211, 211, 211],
	"lightpink": [255, 182, 193],
	"lightsalmon": [255, 160, 122],
	"lightseagreen": [32, 178, 170],
	"lightskyblue": [135, 206, 250],
	"lightslategray": [119, 136, 153],
	"lightslategrey": [119, 136, 153],
	"lightsteelblue": [176, 196, 222],
	"lightyellow": [255, 255, 224],
	"lime": [0, 255, 0],
	"limegreen": [50, 205, 50],
	"linen": [250, 240, 230],
	"magenta": [255, 0, 255],
	"maroon": [128, 0, 0],
	"mediumaquamarine": [102, 205, 170],
	"mediumblue": [0, 0, 205],
	"mediumorchid": [186, 85, 211],
	"mediumpurple": [147, 112, 219],
	"mediumseagreen": [60, 179, 113],
	"mediumslateblue": [123, 104, 238],
	"mediumspringgreen": [0, 250, 154],
	"mediumturquoise": [72, 209, 204],
	"mediumvioletred": [199, 21, 133],
	"midnightblue": [25, 25, 112],
	"mintcream": [245, 255, 250],
	"mistyrose": [255, 228, 225],
	"moccasin": [255, 228, 181],
	"navajowhite": [255, 222, 173],
	"navy": [0, 0, 128],
	"oldlace": [253, 245, 230],
	"olive": [128, 128, 0],
	"olivedrab": [107, 142, 35],
	"orange": [255, 165, 0],
	"orangered": [255, 69, 0],
	"orchid": [218, 112, 214],
	"palegoldenrod": [238, 232, 170],
	"palegreen": [152, 251, 152],
	"paleturquoise": [175, 238, 238],
	"palevioletred": [219, 112, 147],
	"papayawhip": [255, 239, 213],
	"peachpuff": [255, 218, 185],
	"peru": [205, 133, 63],
	"pink": [255, 192, 203],
	"plum": [221, 160, 221],
	"powderblue": [176, 224, 230],
	"purple": [128, 0, 128],
	"rebeccapurple": [102, 51, 153],
	"red": [255, 0, 0],
	"rosybrown": [188, 143, 143],
	"royalblue": [65, 105, 225],
	"saddlebrown": [139, 69, 19],
	"salmon": [250, 128, 114],
	"sandybrown": [244, 164, 96],
	"seagreen": [46, 139, 87],
	"seashell": [255, 245, 238],
	"sienna": [160, 82, 45],
	"silver": [192, 192, 192],
	"skyblue": [135, 206, 235],
	"slateblue": [106, 90, 205],
	"slategray": [112, 128, 144],
	"slategrey": [112, 128, 144],
	"snow": [255, 250, 250],
	"springgreen": [0, 255, 127],
	"steelblue": [70, 130, 180],
	"tan": [210, 180, 140],
	"teal": [0, 128, 128],
	"thistle": [216, 191, 216],
	"tomato": [255, 99, 71],
	"turquoise": [64, 224, 208],
	"violet": [238, 130, 238],
	"wheat": [245, 222, 179],
	"white": [255, 255, 255],
	"whitesmoke": [245, 245, 245],
	"yellow": [255, 255, 0],
	"yellowgreen": [154, 205, 50]
};

/* MIT license */
/* eslint-disable no-mixed-operators */


// NOTE: conversions should only return primitive values (i.e. arrays, or
//       values that give correct `typeof` results).
//       do not use box values types (i.e. Number(), String(), etc.)

const reverseKeywords = {};
for (const key of Object.keys(colorName)) {
	reverseKeywords[colorName[key]] = key;
}

const convert = {
	rgb: {channels: 3, labels: 'rgb'},
	hsl: {channels: 3, labels: 'hsl'},
	hsv: {channels: 3, labels: 'hsv'},
	hwb: {channels: 3, labels: 'hwb'},
	cmyk: {channels: 4, labels: 'cmyk'},
	xyz: {channels: 3, labels: 'xyz'},
	lab: {channels: 3, labels: 'lab'},
	lch: {channels: 3, labels: 'lch'},
	hex: {channels: 1, labels: ['hex']},
	keyword: {channels: 1, labels: ['keyword']},
	ansi16: {channels: 1, labels: ['ansi16']},
	ansi256: {channels: 1, labels: ['ansi256']},
	hcg: {channels: 3, labels: ['h', 'c', 'g']},
	apple: {channels: 3, labels: ['r16', 'g16', 'b16']},
	gray: {channels: 1, labels: ['gray']}
};

var conversions = convert;

// Hide .channels and .labels properties
for (const model of Object.keys(convert)) {
	if (!('channels' in convert[model])) {
		throw new Error('missing channels property: ' + model);
	}

	if (!('labels' in convert[model])) {
		throw new Error('missing channel labels property: ' + model);
	}

	if (convert[model].labels.length !== convert[model].channels) {
		throw new Error('channel and label counts mismatch: ' + model);
	}

	const {channels, labels} = convert[model];
	delete convert[model].channels;
	delete convert[model].labels;
	Object.defineProperty(convert[model], 'channels', {value: channels});
	Object.defineProperty(convert[model], 'labels', {value: labels});
}

convert.rgb.hsl = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const min = Math.min(r, g, b);
	const max = Math.max(r, g, b);
	const delta = max - min;
	let h;
	let s;

	if (max === min) {
		h = 0;
	} else if (r === max) {
		h = (g - b) / delta;
	} else if (g === max) {
		h = 2 + (b - r) / delta;
	} else if (b === max) {
		h = 4 + (r - g) / delta;
	}

	h = Math.min(h * 60, 360);

	if (h < 0) {
		h += 360;
	}

	const l = (min + max) / 2;

	if (max === min) {
		s = 0;
	} else if (l <= 0.5) {
		s = delta / (max + min);
	} else {
		s = delta / (2 - max - min);
	}

	return [h, s * 100, l * 100];
};

convert.rgb.hsv = function (rgb) {
	let rdif;
	let gdif;
	let bdif;
	let h;
	let s;

	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const v = Math.max(r, g, b);
	const diff = v - Math.min(r, g, b);
	const diffc = function (c) {
		return (v - c) / 6 / diff + 1 / 2;
	};

	if (diff === 0) {
		h = 0;
		s = 0;
	} else {
		s = diff / v;
		rdif = diffc(r);
		gdif = diffc(g);
		bdif = diffc(b);

		if (r === v) {
			h = bdif - gdif;
		} else if (g === v) {
			h = (1 / 3) + rdif - bdif;
		} else if (b === v) {
			h = (2 / 3) + gdif - rdif;
		}

		if (h < 0) {
			h += 1;
		} else if (h > 1) {
			h -= 1;
		}
	}

	return [
		h * 360,
		s * 100,
		v * 100
	];
};

convert.rgb.hwb = function (rgb) {
	const r = rgb[0];
	const g = rgb[1];
	let b = rgb[2];
	const h = convert.rgb.hsl(rgb)[0];
	const w = 1 / 255 * Math.min(r, Math.min(g, b));

	b = 1 - 1 / 255 * Math.max(r, Math.max(g, b));

	return [h, w * 100, b * 100];
};

convert.rgb.cmyk = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;

	const k = Math.min(1 - r, 1 - g, 1 - b);
	const c = (1 - r - k) / (1 - k) || 0;
	const m = (1 - g - k) / (1 - k) || 0;
	const y = (1 - b - k) / (1 - k) || 0;

	return [c * 100, m * 100, y * 100, k * 100];
};

function comparativeDistance(x, y) {
	/*
		See https://en.m.wikipedia.org/wiki/Euclidean_distance#Squared_Euclidean_distance
	*/
	return (
		((x[0] - y[0]) ** 2) +
		((x[1] - y[1]) ** 2) +
		((x[2] - y[2]) ** 2)
	);
}

convert.rgb.keyword = function (rgb) {
	const reversed = reverseKeywords[rgb];
	if (reversed) {
		return reversed;
	}

	let currentClosestDistance = Infinity;
	let currentClosestKeyword;

	for (const keyword of Object.keys(colorName)) {
		const value = colorName[keyword];

		// Compute comparative distance
		const distance = comparativeDistance(rgb, value);

		// Check if its less, if so set as closest
		if (distance < currentClosestDistance) {
			currentClosestDistance = distance;
			currentClosestKeyword = keyword;
		}
	}

	return currentClosestKeyword;
};

convert.keyword.rgb = function (keyword) {
	return colorName[keyword];
};

convert.rgb.xyz = function (rgb) {
	let r = rgb[0] / 255;
	let g = rgb[1] / 255;
	let b = rgb[2] / 255;

	// Assume sRGB
	r = r > 0.04045 ? (((r + 0.055) / 1.055) ** 2.4) : (r / 12.92);
	g = g > 0.04045 ? (((g + 0.055) / 1.055) ** 2.4) : (g / 12.92);
	b = b > 0.04045 ? (((b + 0.055) / 1.055) ** 2.4) : (b / 12.92);

	const x = (r * 0.4124) + (g * 0.3576) + (b * 0.1805);
	const y = (r * 0.2126) + (g * 0.7152) + (b * 0.0722);
	const z = (r * 0.0193) + (g * 0.1192) + (b * 0.9505);

	return [x * 100, y * 100, z * 100];
};

convert.rgb.lab = function (rgb) {
	const xyz = convert.rgb.xyz(rgb);
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.hsl.rgb = function (hsl) {
	const h = hsl[0] / 360;
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;
	let t2;
	let t3;
	let val;

	if (s === 0) {
		val = l * 255;
		return [val, val, val];
	}

	if (l < 0.5) {
		t2 = l * (1 + s);
	} else {
		t2 = l + s - l * s;
	}

	const t1 = 2 * l - t2;

	const rgb = [0, 0, 0];
	for (let i = 0; i < 3; i++) {
		t3 = h + 1 / 3 * -(i - 1);
		if (t3 < 0) {
			t3++;
		}

		if (t3 > 1) {
			t3--;
		}

		if (6 * t3 < 1) {
			val = t1 + (t2 - t1) * 6 * t3;
		} else if (2 * t3 < 1) {
			val = t2;
		} else if (3 * t3 < 2) {
			val = t1 + (t2 - t1) * (2 / 3 - t3) * 6;
		} else {
			val = t1;
		}

		rgb[i] = val * 255;
	}

	return rgb;
};

convert.hsl.hsv = function (hsl) {
	const h = hsl[0];
	let s = hsl[1] / 100;
	let l = hsl[2] / 100;
	let smin = s;
	const lmin = Math.max(l, 0.01);

	l *= 2;
	s *= (l <= 1) ? l : 2 - l;
	smin *= lmin <= 1 ? lmin : 2 - lmin;
	const v = (l + s) / 2;
	const sv = l === 0 ? (2 * smin) / (lmin + smin) : (2 * s) / (l + s);

	return [h, sv * 100, v * 100];
};

convert.hsv.rgb = function (hsv) {
	const h = hsv[0] / 60;
	const s = hsv[1] / 100;
	let v = hsv[2] / 100;
	const hi = Math.floor(h) % 6;

	const f = h - Math.floor(h);
	const p = 255 * v * (1 - s);
	const q = 255 * v * (1 - (s * f));
	const t = 255 * v * (1 - (s * (1 - f)));
	v *= 255;

	switch (hi) {
		case 0:
			return [v, t, p];
		case 1:
			return [q, v, p];
		case 2:
			return [p, v, t];
		case 3:
			return [p, q, v];
		case 4:
			return [t, p, v];
		case 5:
			return [v, p, q];
	}
};

convert.hsv.hsl = function (hsv) {
	const h = hsv[0];
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;
	const vmin = Math.max(v, 0.01);
	let sl;
	let l;

	l = (2 - s) * v;
	const lmin = (2 - s) * vmin;
	sl = s * vmin;
	sl /= (lmin <= 1) ? lmin : 2 - lmin;
	sl = sl || 0;
	l /= 2;

	return [h, sl * 100, l * 100];
};

// http://dev.w3.org/csswg/css-color/#hwb-to-rgb
convert.hwb.rgb = function (hwb) {
	const h = hwb[0] / 360;
	let wh = hwb[1] / 100;
	let bl = hwb[2] / 100;
	const ratio = wh + bl;
	let f;

	// Wh + bl cant be > 1
	if (ratio > 1) {
		wh /= ratio;
		bl /= ratio;
	}

	const i = Math.floor(6 * h);
	const v = 1 - bl;
	f = 6 * h - i;

	if ((i & 0x01) !== 0) {
		f = 1 - f;
	}

	const n = wh + f * (v - wh); // Linear interpolation

	let r;
	let g;
	let b;
	/* eslint-disable max-statements-per-line,no-multi-spaces */
	switch (i) {
		default:
		case 6:
		case 0: r = v;  g = n;  b = wh; break;
		case 1: r = n;  g = v;  b = wh; break;
		case 2: r = wh; g = v;  b = n; break;
		case 3: r = wh; g = n;  b = v; break;
		case 4: r = n;  g = wh; b = v; break;
		case 5: r = v;  g = wh; b = n; break;
	}
	/* eslint-enable max-statements-per-line,no-multi-spaces */

	return [r * 255, g * 255, b * 255];
};

convert.cmyk.rgb = function (cmyk) {
	const c = cmyk[0] / 100;
	const m = cmyk[1] / 100;
	const y = cmyk[2] / 100;
	const k = cmyk[3] / 100;

	const r = 1 - Math.min(1, c * (1 - k) + k);
	const g = 1 - Math.min(1, m * (1 - k) + k);
	const b = 1 - Math.min(1, y * (1 - k) + k);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.rgb = function (xyz) {
	const x = xyz[0] / 100;
	const y = xyz[1] / 100;
	const z = xyz[2] / 100;
	let r;
	let g;
	let b;

	r = (x * 3.2406) + (y * -1.5372) + (z * -0.4986);
	g = (x * -0.9689) + (y * 1.8758) + (z * 0.0415);
	b = (x * 0.0557) + (y * -0.2040) + (z * 1.0570);

	// Assume sRGB
	r = r > 0.0031308
		? ((1.055 * (r ** (1.0 / 2.4))) - 0.055)
		: r * 12.92;

	g = g > 0.0031308
		? ((1.055 * (g ** (1.0 / 2.4))) - 0.055)
		: g * 12.92;

	b = b > 0.0031308
		? ((1.055 * (b ** (1.0 / 2.4))) - 0.055)
		: b * 12.92;

	r = Math.min(Math.max(0, r), 1);
	g = Math.min(Math.max(0, g), 1);
	b = Math.min(Math.max(0, b), 1);

	return [r * 255, g * 255, b * 255];
};

convert.xyz.lab = function (xyz) {
	let x = xyz[0];
	let y = xyz[1];
	let z = xyz[2];

	x /= 95.047;
	y /= 100;
	z /= 108.883;

	x = x > 0.008856 ? (x ** (1 / 3)) : (7.787 * x) + (16 / 116);
	y = y > 0.008856 ? (y ** (1 / 3)) : (7.787 * y) + (16 / 116);
	z = z > 0.008856 ? (z ** (1 / 3)) : (7.787 * z) + (16 / 116);

	const l = (116 * y) - 16;
	const a = 500 * (x - y);
	const b = 200 * (y - z);

	return [l, a, b];
};

convert.lab.xyz = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let x;
	let y;
	let z;

	y = (l + 16) / 116;
	x = a / 500 + y;
	z = y - b / 200;

	const y2 = y ** 3;
	const x2 = x ** 3;
	const z2 = z ** 3;
	y = y2 > 0.008856 ? y2 : (y - 16 / 116) / 7.787;
	x = x2 > 0.008856 ? x2 : (x - 16 / 116) / 7.787;
	z = z2 > 0.008856 ? z2 : (z - 16 / 116) / 7.787;

	x *= 95.047;
	y *= 100;
	z *= 108.883;

	return [x, y, z];
};

convert.lab.lch = function (lab) {
	const l = lab[0];
	const a = lab[1];
	const b = lab[2];
	let h;

	const hr = Math.atan2(b, a);
	h = hr * 360 / 2 / Math.PI;

	if (h < 0) {
		h += 360;
	}

	const c = Math.sqrt(a * a + b * b);

	return [l, c, h];
};

convert.lch.lab = function (lch) {
	const l = lch[0];
	const c = lch[1];
	const h = lch[2];

	const hr = h / 360 * 2 * Math.PI;
	const a = c * Math.cos(hr);
	const b = c * Math.sin(hr);

	return [l, a, b];
};

convert.rgb.ansi16 = function (args, saturation = null) {
	const [r, g, b] = args;
	let value = saturation === null ? convert.rgb.hsv(args)[2] : saturation; // Hsv -> ansi16 optimization

	value = Math.round(value / 50);

	if (value === 0) {
		return 30;
	}

	let ansi = 30
		+ ((Math.round(b / 255) << 2)
		| (Math.round(g / 255) << 1)
		| Math.round(r / 255));

	if (value === 2) {
		ansi += 60;
	}

	return ansi;
};

convert.hsv.ansi16 = function (args) {
	// Optimization here; we already know the value and don't need to get
	// it converted for us.
	return convert.rgb.ansi16(convert.hsv.rgb(args), args[2]);
};

convert.rgb.ansi256 = function (args) {
	const r = args[0];
	const g = args[1];
	const b = args[2];

	// We use the extended greyscale palette here, with the exception of
	// black and white. normal palette only has 4 greyscale shades.
	if (r === g && g === b) {
		if (r < 8) {
			return 16;
		}

		if (r > 248) {
			return 231;
		}

		return Math.round(((r - 8) / 247) * 24) + 232;
	}

	const ansi = 16
		+ (36 * Math.round(r / 255 * 5))
		+ (6 * Math.round(g / 255 * 5))
		+ Math.round(b / 255 * 5);

	return ansi;
};

convert.ansi16.rgb = function (args) {
	let color = args % 10;

	// Handle greyscale
	if (color === 0 || color === 7) {
		if (args > 50) {
			color += 3.5;
		}

		color = color / 10.5 * 255;

		return [color, color, color];
	}

	const mult = (~~(args > 50) + 1) * 0.5;
	const r = ((color & 1) * mult) * 255;
	const g = (((color >> 1) & 1) * mult) * 255;
	const b = (((color >> 2) & 1) * mult) * 255;

	return [r, g, b];
};

convert.ansi256.rgb = function (args) {
	// Handle greyscale
	if (args >= 232) {
		const c = (args - 232) * 10 + 8;
		return [c, c, c];
	}

	args -= 16;

	let rem;
	const r = Math.floor(args / 36) / 5 * 255;
	const g = Math.floor((rem = args % 36) / 6) / 5 * 255;
	const b = (rem % 6) / 5 * 255;

	return [r, g, b];
};

convert.rgb.hex = function (args) {
	const integer = ((Math.round(args[0]) & 0xFF) << 16)
		+ ((Math.round(args[1]) & 0xFF) << 8)
		+ (Math.round(args[2]) & 0xFF);

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.hex.rgb = function (args) {
	const match = args.toString(16).match(/[a-f0-9]{6}|[a-f0-9]{3}/i);
	if (!match) {
		return [0, 0, 0];
	}

	let colorString = match[0];

	if (match[0].length === 3) {
		colorString = colorString.split('').map(char => {
			return char + char;
		}).join('');
	}

	const integer = parseInt(colorString, 16);
	const r = (integer >> 16) & 0xFF;
	const g = (integer >> 8) & 0xFF;
	const b = integer & 0xFF;

	return [r, g, b];
};

convert.rgb.hcg = function (rgb) {
	const r = rgb[0] / 255;
	const g = rgb[1] / 255;
	const b = rgb[2] / 255;
	const max = Math.max(Math.max(r, g), b);
	const min = Math.min(Math.min(r, g), b);
	const chroma = (max - min);
	let grayscale;
	let hue;

	if (chroma < 1) {
		grayscale = min / (1 - chroma);
	} else {
		grayscale = 0;
	}

	if (chroma <= 0) {
		hue = 0;
	} else
	if (max === r) {
		hue = ((g - b) / chroma) % 6;
	} else
	if (max === g) {
		hue = 2 + (b - r) / chroma;
	} else {
		hue = 4 + (r - g) / chroma;
	}

	hue /= 6;
	hue %= 1;

	return [hue * 360, chroma * 100, grayscale * 100];
};

convert.hsl.hcg = function (hsl) {
	const s = hsl[1] / 100;
	const l = hsl[2] / 100;

	const c = l < 0.5 ? (2.0 * s * l) : (2.0 * s * (1.0 - l));

	let f = 0;
	if (c < 1.0) {
		f = (l - 0.5 * c) / (1.0 - c);
	}

	return [hsl[0], c * 100, f * 100];
};

convert.hsv.hcg = function (hsv) {
	const s = hsv[1] / 100;
	const v = hsv[2] / 100;

	const c = s * v;
	let f = 0;

	if (c < 1.0) {
		f = (v - c) / (1 - c);
	}

	return [hsv[0], c * 100, f * 100];
};

convert.hcg.rgb = function (hcg) {
	const h = hcg[0] / 360;
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	if (c === 0.0) {
		return [g * 255, g * 255, g * 255];
	}

	const pure = [0, 0, 0];
	const hi = (h % 1) * 6;
	const v = hi % 1;
	const w = 1 - v;
	let mg = 0;

	/* eslint-disable max-statements-per-line */
	switch (Math.floor(hi)) {
		case 0:
			pure[0] = 1; pure[1] = v; pure[2] = 0; break;
		case 1:
			pure[0] = w; pure[1] = 1; pure[2] = 0; break;
		case 2:
			pure[0] = 0; pure[1] = 1; pure[2] = v; break;
		case 3:
			pure[0] = 0; pure[1] = w; pure[2] = 1; break;
		case 4:
			pure[0] = v; pure[1] = 0; pure[2] = 1; break;
		default:
			pure[0] = 1; pure[1] = 0; pure[2] = w;
	}
	/* eslint-enable max-statements-per-line */

	mg = (1.0 - c) * g;

	return [
		(c * pure[0] + mg) * 255,
		(c * pure[1] + mg) * 255,
		(c * pure[2] + mg) * 255
	];
};

convert.hcg.hsv = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const v = c + g * (1.0 - c);
	let f = 0;

	if (v > 0.0) {
		f = c / v;
	}

	return [hcg[0], f * 100, v * 100];
};

convert.hcg.hsl = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;

	const l = g * (1.0 - c) + 0.5 * c;
	let s = 0;

	if (l > 0.0 && l < 0.5) {
		s = c / (2 * l);
	} else
	if (l >= 0.5 && l < 1.0) {
		s = c / (2 * (1 - l));
	}

	return [hcg[0], s * 100, l * 100];
};

convert.hcg.hwb = function (hcg) {
	const c = hcg[1] / 100;
	const g = hcg[2] / 100;
	const v = c + g * (1.0 - c);
	return [hcg[0], (v - c) * 100, (1 - v) * 100];
};

convert.hwb.hcg = function (hwb) {
	const w = hwb[1] / 100;
	const b = hwb[2] / 100;
	const v = 1 - b;
	const c = v - w;
	let g = 0;

	if (c < 1) {
		g = (v - c) / (1 - c);
	}

	return [hwb[0], c * 100, g * 100];
};

convert.apple.rgb = function (apple) {
	return [(apple[0] / 65535) * 255, (apple[1] / 65535) * 255, (apple[2] / 65535) * 255];
};

convert.rgb.apple = function (rgb) {
	return [(rgb[0] / 255) * 65535, (rgb[1] / 255) * 65535, (rgb[2] / 255) * 65535];
};

convert.gray.rgb = function (args) {
	return [args[0] / 100 * 255, args[0] / 100 * 255, args[0] / 100 * 255];
};

convert.gray.hsl = function (args) {
	return [0, 0, args[0]];
};

convert.gray.hsv = convert.gray.hsl;

convert.gray.hwb = function (gray) {
	return [0, 100, gray[0]];
};

convert.gray.cmyk = function (gray) {
	return [0, 0, 0, gray[0]];
};

convert.gray.lab = function (gray) {
	return [gray[0], 0, 0];
};

convert.gray.hex = function (gray) {
	const val = Math.round(gray[0] / 100 * 255) & 0xFF;
	const integer = (val << 16) + (val << 8) + val;

	const string = integer.toString(16).toUpperCase();
	return '000000'.substring(string.length) + string;
};

convert.rgb.gray = function (rgb) {
	const val = (rgb[0] + rgb[1] + rgb[2]) / 3;
	return [val / 255 * 100];
};

/*
	This function routes a model to all other models.

	all functions that are routed have a property `.conversion` attached
	to the returned synthetic function. This property is an array
	of strings, each with the steps in between the 'from' and 'to'
	color models (inclusive).

	conversions that are not possible simply are not included.
*/

function buildGraph() {
	const graph = {};
	// https://jsperf.com/object-keys-vs-for-in-with-closure/3
	const models = Object.keys(conversions);

	for (let len = models.length, i = 0; i < len; i++) {
		graph[models[i]] = {
			// http://jsperf.com/1-vs-infinity
			// micro-opt, but this is simple.
			distance: -1,
			parent: null
		};
	}

	return graph;
}

// https://en.wikipedia.org/wiki/Breadth-first_search
function deriveBFS(fromModel) {
	const graph = buildGraph();
	const queue = [fromModel]; // Unshift -> queue -> pop

	graph[fromModel].distance = 0;

	while (queue.length) {
		const current = queue.pop();
		const adjacents = Object.keys(conversions[current]);

		for (let len = adjacents.length, i = 0; i < len; i++) {
			const adjacent = adjacents[i];
			const node = graph[adjacent];

			if (node.distance === -1) {
				node.distance = graph[current].distance + 1;
				node.parent = current;
				queue.unshift(adjacent);
			}
		}
	}

	return graph;
}

function link(from, to) {
	return function (args) {
		return to(from(args));
	};
}

function wrapConversion(toModel, graph) {
	const path = [graph[toModel].parent, toModel];
	let fn = conversions[graph[toModel].parent][toModel];

	let cur = graph[toModel].parent;
	while (graph[cur].parent) {
		path.unshift(graph[cur].parent);
		fn = link(conversions[graph[cur].parent][cur], fn);
		cur = graph[cur].parent;
	}

	fn.conversion = path;
	return fn;
}

var route = function (fromModel) {
	const graph = deriveBFS(fromModel);
	const conversion = {};

	const models = Object.keys(graph);
	for (let len = models.length, i = 0; i < len; i++) {
		const toModel = models[i];
		const node = graph[toModel];

		if (node.parent === null) {
			// No possible conversion, or this node is the source model.
			continue;
		}

		conversion[toModel] = wrapConversion(toModel, graph);
	}

	return conversion;
};

const convert$1 = {};

const models = Object.keys(conversions);

function wrapRaw(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];
		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		return fn(args);
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

function wrapRounded(fn) {
	const wrappedFn = function (...args) {
		const arg0 = args[0];

		if (arg0 === undefined || arg0 === null) {
			return arg0;
		}

		if (arg0.length > 1) {
			args = arg0;
		}

		const result = fn(args);

		// We're assuming the result is an array here.
		// see notice in conversions.js; don't use box types
		// in conversion functions.
		if (typeof result === 'object') {
			for (let len = result.length, i = 0; i < len; i++) {
				result[i] = Math.round(result[i]);
			}
		}

		return result;
	};

	// Preserve .conversion property if there is one
	if ('conversion' in fn) {
		wrappedFn.conversion = fn.conversion;
	}

	return wrappedFn;
}

models.forEach(fromModel => {
	convert$1[fromModel] = {};

	Object.defineProperty(convert$1[fromModel], 'channels', {value: conversions[fromModel].channels});
	Object.defineProperty(convert$1[fromModel], 'labels', {value: conversions[fromModel].labels});

	const routes = route(fromModel);
	const routeModels = Object.keys(routes);

	routeModels.forEach(toModel => {
		const fn = routes[toModel];

		convert$1[fromModel][toModel] = wrapRounded(fn);
		convert$1[fromModel][toModel].raw = wrapRaw(fn);
	});
});

var colorConvert = convert$1;

var ansiStyles = createCommonjsModule(function (module) {

const wrapAnsi16 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${code + offset}m`;
};

const wrapAnsi256 = (fn, offset) => (...args) => {
	const code = fn(...args);
	return `\u001B[${38 + offset};5;${code}m`;
};

const wrapAnsi16m = (fn, offset) => (...args) => {
	const rgb = fn(...args);
	return `\u001B[${38 + offset};2;${rgb[0]};${rgb[1]};${rgb[2]}m`;
};

const ansi2ansi = n => n;
const rgb2rgb = (r, g, b) => [r, g, b];

const setLazyProperty = (object, property, get) => {
	Object.defineProperty(object, property, {
		get: () => {
			const value = get();

			Object.defineProperty(object, property, {
				value,
				enumerable: true,
				configurable: true
			});

			return value;
		},
		enumerable: true,
		configurable: true
	});
};

/** @type {typeof import('color-convert')} */
let colorConvert$1;
const makeDynamicStyles = (wrap, targetSpace, identity, isBackground) => {
	if (colorConvert$1 === undefined) {
		colorConvert$1 = colorConvert;
	}

	const offset = isBackground ? 10 : 0;
	const styles = {};

	for (const [sourceSpace, suite] of Object.entries(colorConvert$1)) {
		const name = sourceSpace === 'ansi16' ? 'ansi' : sourceSpace;
		if (sourceSpace === targetSpace) {
			styles[name] = wrap(identity, offset);
		} else if (typeof suite === 'object') {
			styles[name] = wrap(suite[targetSpace], offset);
		}
	}

	return styles;
};

function assembleStyles() {
	const codes = new Map();
	const styles = {
		modifier: {
			reset: [0, 0],
			// 21 isn't widely supported and 22 does the same thing
			bold: [1, 22],
			dim: [2, 22],
			italic: [3, 23],
			underline: [4, 24],
			inverse: [7, 27],
			hidden: [8, 28],
			strikethrough: [9, 29]
		},
		color: {
			black: [30, 39],
			red: [31, 39],
			green: [32, 39],
			yellow: [33, 39],
			blue: [34, 39],
			magenta: [35, 39],
			cyan: [36, 39],
			white: [37, 39],

			// Bright color
			blackBright: [90, 39],
			redBright: [91, 39],
			greenBright: [92, 39],
			yellowBright: [93, 39],
			blueBright: [94, 39],
			magentaBright: [95, 39],
			cyanBright: [96, 39],
			whiteBright: [97, 39]
		},
		bgColor: {
			bgBlack: [40, 49],
			bgRed: [41, 49],
			bgGreen: [42, 49],
			bgYellow: [43, 49],
			bgBlue: [44, 49],
			bgMagenta: [45, 49],
			bgCyan: [46, 49],
			bgWhite: [47, 49],

			// Bright color
			bgBlackBright: [100, 49],
			bgRedBright: [101, 49],
			bgGreenBright: [102, 49],
			bgYellowBright: [103, 49],
			bgBlueBright: [104, 49],
			bgMagentaBright: [105, 49],
			bgCyanBright: [106, 49],
			bgWhiteBright: [107, 49]
		}
	};

	// Alias bright black as gray (and grey)
	styles.color.gray = styles.color.blackBright;
	styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
	styles.color.grey = styles.color.blackBright;
	styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;

	for (const [groupName, group] of Object.entries(styles)) {
		for (const [styleName, style] of Object.entries(group)) {
			styles[styleName] = {
				open: `\u001B[${style[0]}m`,
				close: `\u001B[${style[1]}m`
			};

			group[styleName] = styles[styleName];

			codes.set(style[0], style[1]);
		}

		Object.defineProperty(styles, groupName, {
			value: group,
			enumerable: false
		});
	}

	Object.defineProperty(styles, 'codes', {
		value: codes,
		enumerable: false
	});

	styles.color.close = '\u001B[39m';
	styles.bgColor.close = '\u001B[49m';

	setLazyProperty(styles.color, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, false));
	setLazyProperty(styles.color, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, false));
	setLazyProperty(styles.bgColor, 'ansi', () => makeDynamicStyles(wrapAnsi16, 'ansi16', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi256', () => makeDynamicStyles(wrapAnsi256, 'ansi256', ansi2ansi, true));
	setLazyProperty(styles.bgColor, 'ansi16m', () => makeDynamicStyles(wrapAnsi16m, 'rgb', rgb2rgb, true));

	return styles;
}

// Make the export immutable
Object.defineProperty(module, 'exports', {
	enumerable: true,
	get: assembleStyles
});
});

var hasFlag = (flag, argv = process.argv) => {
	const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
	const position = argv.indexOf(prefix + flag);
	const terminatorPosition = argv.indexOf('--');
	return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};

const {env} = process;

let forceColor;
if (hasFlag('no-color') ||
	hasFlag('no-colors') ||
	hasFlag('color=false') ||
	hasFlag('color=never')) {
	forceColor = 0;
} else if (hasFlag('color') ||
	hasFlag('colors') ||
	hasFlag('color=true') ||
	hasFlag('color=always')) {
	forceColor = 1;
}

if ('FORCE_COLOR' in env) {
	if (env.FORCE_COLOR === 'true') {
		forceColor = 1;
	} else if (env.FORCE_COLOR === 'false') {
		forceColor = 0;
	} else {
		forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
	}
}

function translateLevel(level) {
	if (level === 0) {
		return false;
	}

	return {
		level,
		hasBasic: true,
		has256: level >= 2,
		has16m: level >= 3
	};
}

function supportsColor(haveStream, streamIsTTY) {
	if (forceColor === 0) {
		return 0;
	}

	if (hasFlag('color=16m') ||
		hasFlag('color=full') ||
		hasFlag('color=truecolor')) {
		return 3;
	}

	if (hasFlag('color=256')) {
		return 2;
	}

	if (haveStream && !streamIsTTY && forceColor === undefined) {
		return 0;
	}

	const min = forceColor || 0;

	if (env.TERM === 'dumb') {
		return min;
	}

	if (process.platform === 'win32') {
		// Windows 10 build 10586 is the first Windows release that supports 256 colors.
		// Windows 10 build 14931 is the first release that supports 16m/TrueColor.
		const osRelease = os.release().split('.');
		if (
			Number(osRelease[0]) >= 10 &&
			Number(osRelease[2]) >= 10586
		) {
			return Number(osRelease[2]) >= 14931 ? 3 : 2;
		}

		return 1;
	}

	if ('CI' in env) {
		if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
			return 1;
		}

		return min;
	}

	if ('TEAMCITY_VERSION' in env) {
		return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
	}

	if ('GITHUB_ACTIONS' in env) {
		return 1;
	}

	if (env.COLORTERM === 'truecolor') {
		return 3;
	}

	if ('TERM_PROGRAM' in env) {
		const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);

		switch (env.TERM_PROGRAM) {
			case 'iTerm.app':
				return version >= 3 ? 3 : 2;
			case 'Apple_Terminal':
				return 2;
			// No default
		}
	}

	if (/-256(color)?$/i.test(env.TERM)) {
		return 2;
	}

	if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
		return 1;
	}

	if ('COLORTERM' in env) {
		return 1;
	}

	return min;
}

function getSupportLevel(stream) {
	const level = supportsColor(stream, stream && stream.isTTY);
	return translateLevel(level);
}

var supportsColor_1 = {
	supportsColor: getSupportLevel,
	stdout: translateLevel(supportsColor(true, tty.isatty(1))),
	stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};

const stringReplaceAll = (string, substring, replacer) => {
	let index = string.indexOf(substring);
	if (index === -1) {
		return string;
	}

	const substringLength = substring.length;
	let endIndex = 0;
	let returnValue = '';
	do {
		returnValue += string.substr(endIndex, index - endIndex) + substring + replacer;
		endIndex = index + substringLength;
		index = string.indexOf(substring, endIndex);
	} while (index !== -1);

	returnValue += string.substr(endIndex);
	return returnValue;
};

const stringEncaseCRLFWithFirstIndex = (string, prefix, postfix, index) => {
	let endIndex = 0;
	let returnValue = '';
	do {
		const gotCR = string[index - 1] === '\r';
		returnValue += string.substr(endIndex, (gotCR ? index - 1 : index) - endIndex) + prefix + (gotCR ? '\r\n' : '\n') + postfix;
		endIndex = index + 1;
		index = string.indexOf('\n', endIndex);
	} while (index !== -1);

	returnValue += string.substr(endIndex);
	return returnValue;
};

var util = {
	stringReplaceAll,
	stringEncaseCRLFWithFirstIndex
};

const TEMPLATE_REGEX = /(?:\\(u(?:[a-f\d]{4}|\{[a-f\d]{1,6}\})|x[a-f\d]{2}|.))|(?:\{(~)?(\w+(?:\([^)]*\))?(?:\.\w+(?:\([^)]*\))?)*)(?:[ \t]|(?=\r?\n)))|(\})|((?:.|[\r\n\f])+?)/gi;
const STYLE_REGEX = /(?:^|\.)(\w+)(?:\(([^)]*)\))?/g;
const STRING_REGEX = /^(['"])((?:\\.|(?!\1)[^\\])*)\1$/;
const ESCAPE_REGEX = /\\(u(?:[a-f\d]{4}|{[a-f\d]{1,6}})|x[a-f\d]{2}|.)|([^\\])/gi;

const ESCAPES = new Map([
	['n', '\n'],
	['r', '\r'],
	['t', '\t'],
	['b', '\b'],
	['f', '\f'],
	['v', '\v'],
	['0', '\0'],
	['\\', '\\'],
	['e', '\u001B'],
	['a', '\u0007']
]);

function unescape(c) {
	const u = c[0] === 'u';
	const bracket = c[1] === '{';

	if ((u && !bracket && c.length === 5) || (c[0] === 'x' && c.length === 3)) {
		return String.fromCharCode(parseInt(c.slice(1), 16));
	}

	if (u && bracket) {
		return String.fromCodePoint(parseInt(c.slice(2, -1), 16));
	}

	return ESCAPES.get(c) || c;
}

function parseArguments(name, arguments_) {
	const results = [];
	const chunks = arguments_.trim().split(/\s*,\s*/g);
	let matches;

	for (const chunk of chunks) {
		const number = Number(chunk);
		if (!Number.isNaN(number)) {
			results.push(number);
		} else if ((matches = chunk.match(STRING_REGEX))) {
			results.push(matches[2].replace(ESCAPE_REGEX, (m, escape, character) => escape ? unescape(escape) : character));
		} else {
			throw new Error(`Invalid Chalk template style argument: ${chunk} (in style '${name}')`);
		}
	}

	return results;
}

function parseStyle(style) {
	STYLE_REGEX.lastIndex = 0;

	const results = [];
	let matches;

	while ((matches = STYLE_REGEX.exec(style)) !== null) {
		const name = matches[1];

		if (matches[2]) {
			const args = parseArguments(name, matches[2]);
			results.push([name].concat(args));
		} else {
			results.push([name]);
		}
	}

	return results;
}

function buildStyle(chalk, styles) {
	const enabled = {};

	for (const layer of styles) {
		for (const style of layer.styles) {
			enabled[style[0]] = layer.inverse ? null : style.slice(1);
		}
	}

	let current = chalk;
	for (const [styleName, styles] of Object.entries(enabled)) {
		if (!Array.isArray(styles)) {
			continue;
		}

		if (!(styleName in current)) {
			throw new Error(`Unknown Chalk style: ${styleName}`);
		}

		current = styles.length > 0 ? current[styleName](...styles) : current[styleName];
	}

	return current;
}

var templates = (chalk, temporary) => {
	const styles = [];
	const chunks = [];
	let chunk = [];

	// eslint-disable-next-line max-params
	temporary.replace(TEMPLATE_REGEX, (m, escapeCharacter, inverse, style, close, character) => {
		if (escapeCharacter) {
			chunk.push(unescape(escapeCharacter));
		} else if (style) {
			const string = chunk.join('');
			chunk = [];
			chunks.push(styles.length === 0 ? string : buildStyle(chalk, styles)(string));
			styles.push({inverse, styles: parseStyle(style)});
		} else if (close) {
			if (styles.length === 0) {
				throw new Error('Found extraneous } in Chalk template literal');
			}

			chunks.push(buildStyle(chalk, styles)(chunk.join('')));
			chunk = [];
			styles.pop();
		} else {
			chunk.push(character);
		}
	});

	chunks.push(chunk.join(''));

	if (styles.length > 0) {
		const errMessage = `Chalk template literal is missing ${styles.length} closing bracket${styles.length === 1 ? '' : 's'} (\`}\`)`;
		throw new Error(errMessage);
	}

	return chunks.join('');
};

const {stdout: stdoutColor, stderr: stderrColor} = supportsColor_1;
const {
	stringReplaceAll: stringReplaceAll$1,
	stringEncaseCRLFWithFirstIndex: stringEncaseCRLFWithFirstIndex$1
} = util;

const {isArray} = Array;

// `supportsColor.level` → `ansiStyles.color[name]` mapping
const levelMapping = [
	'ansi',
	'ansi',
	'ansi256',
	'ansi16m'
];

const styles = Object.create(null);

const applyOptions = (object, options = {}) => {
	if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
		throw new Error('The `level` option should be an integer from 0 to 3');
	}

	// Detect level if not set manually
	const colorLevel = stdoutColor ? stdoutColor.level : 0;
	object.level = options.level === undefined ? colorLevel : options.level;
};

class ChalkClass {
	constructor(options) {
		// eslint-disable-next-line no-constructor-return
		return chalkFactory(options);
	}
}

const chalkFactory = options => {
	const chalk = {};
	applyOptions(chalk, options);

	chalk.template = (...arguments_) => chalkTag(chalk.template, ...arguments_);

	Object.setPrototypeOf(chalk, Chalk.prototype);
	Object.setPrototypeOf(chalk.template, chalk);

	chalk.template.constructor = () => {
		throw new Error('`chalk.constructor()` is deprecated. Use `new chalk.Instance()` instead.');
	};

	chalk.template.Instance = ChalkClass;

	return chalk.template;
};

function Chalk(options) {
	return chalkFactory(options);
}

for (const [styleName, style] of Object.entries(ansiStyles)) {
	styles[styleName] = {
		get() {
			const builder = createBuilder(this, createStyler(style.open, style.close, this._styler), this._isEmpty);
			Object.defineProperty(this, styleName, {value: builder});
			return builder;
		}
	};
}

styles.visible = {
	get() {
		const builder = createBuilder(this, this._styler, true);
		Object.defineProperty(this, 'visible', {value: builder});
		return builder;
	}
};

const usedModels = ['rgb', 'hex', 'keyword', 'hsl', 'hsv', 'hwb', 'ansi', 'ansi256'];

for (const model of usedModels) {
	styles[model] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(ansiStyles.color[levelMapping[level]][model](...arguments_), ansiStyles.color.close, this._styler);
				return createBuilder(this, styler, this._isEmpty);
			};
		}
	};
}

for (const model of usedModels) {
	const bgModel = 'bg' + model[0].toUpperCase() + model.slice(1);
	styles[bgModel] = {
		get() {
			const {level} = this;
			return function (...arguments_) {
				const styler = createStyler(ansiStyles.bgColor[levelMapping[level]][model](...arguments_), ansiStyles.bgColor.close, this._styler);
				return createBuilder(this, styler, this._isEmpty);
			};
		}
	};
}

const proto = Object.defineProperties(() => {}, {
	...styles,
	level: {
		enumerable: true,
		get() {
			return this._generator.level;
		},
		set(level) {
			this._generator.level = level;
		}
	}
});

const createStyler = (open, close, parent) => {
	let openAll;
	let closeAll;
	if (parent === undefined) {
		openAll = open;
		closeAll = close;
	} else {
		openAll = parent.openAll + open;
		closeAll = close + parent.closeAll;
	}

	return {
		open,
		close,
		openAll,
		closeAll,
		parent
	};
};

const createBuilder = (self, _styler, _isEmpty) => {
	const builder = (...arguments_) => {
		if (isArray(arguments_[0]) && isArray(arguments_[0].raw)) {
			// Called as a template literal, for example: chalk.red`2 + 3 = {bold ${2+3}}`
			return applyStyle(builder, chalkTag(builder, ...arguments_));
		}

		// Single argument is hot path, implicit coercion is faster than anything
		// eslint-disable-next-line no-implicit-coercion
		return applyStyle(builder, (arguments_.length === 1) ? ('' + arguments_[0]) : arguments_.join(' '));
	};

	// We alter the prototype because we must return a function, but there is
	// no way to create a function with a different prototype
	Object.setPrototypeOf(builder, proto);

	builder._generator = self;
	builder._styler = _styler;
	builder._isEmpty = _isEmpty;

	return builder;
};

const applyStyle = (self, string) => {
	if (self.level <= 0 || !string) {
		return self._isEmpty ? '' : string;
	}

	let styler = self._styler;

	if (styler === undefined) {
		return string;
	}

	const {openAll, closeAll} = styler;
	if (string.indexOf('\u001B') !== -1) {
		while (styler !== undefined) {
			// Replace any instances already present with a re-opening code
			// otherwise only the part of the string until said closing code
			// will be colored, and the rest will simply be 'plain'.
			string = stringReplaceAll$1(string, styler.close, styler.open);

			styler = styler.parent;
		}
	}

	// We can move both next actions out of loop, because remaining actions in loop won't have
	// any/visible effect on parts we add here. Close the styling before a linebreak and reopen
	// after next line to fix a bleed issue on macOS: https://github.com/chalk/chalk/pull/92
	const lfIndex = string.indexOf('\n');
	if (lfIndex !== -1) {
		string = stringEncaseCRLFWithFirstIndex$1(string, closeAll, openAll, lfIndex);
	}

	return openAll + string + closeAll;
};

let template;
const chalkTag = (chalk, ...strings) => {
	const [firstString] = strings;

	if (!isArray(firstString) || !isArray(firstString.raw)) {
		// If chalk() was called by itself or with a string,
		// return the string itself as a string.
		return strings.join(' ');
	}

	const arguments_ = strings.slice(1);
	const parts = [firstString.raw[0]];

	for (let i = 1; i < firstString.length; i++) {
		parts.push(
			String(arguments_[i - 1]).replace(/[{}\\]/g, '\\$&'),
			String(firstString.raw[i])
		);
	}

	if (template === undefined) {
		template = templates;
	}

	return template(chalk, parts.join(''));
};

Object.defineProperties(Chalk.prototype, styles);

const chalk = Chalk(); // eslint-disable-line new-cap
chalk.supportsColor = stdoutColor;
chalk.stderr = Chalk({level: stderrColor ? stderrColor.level : 0}); // eslint-disable-line new-cap
chalk.stderr.supportsColor = stderrColor;

var source = chalk;

var name = "moment-guess";
var version = "1.2.4-alexb.1";
var description = "A utility package for guessing date's format";
var homepage = "https://github.com/apoorv-mishra/moment-guess#readme";
var repository = {
	type: "git",
	url: "git+https://github.com/apoorv-mishra/moment-guess.git"
};
var bugs = {
	url: "https://github.com/apoorv-mishra/moment-guess/issues"
};
var main = "dist/bundle.js";
var module$1 = "dist/bundle.esm.js";
var bin = {
	"moment-guess": "bin/bundle.cmd.js"
};
var scripts = {
	test: "jest",
	build: "rollup -c && rm -rf dist/dts",
	dev: "rollup -c -w",
	pretest: "npm run build"
};
var author = "Apoorv Mishra";
var license = "MIT";
var devDependencies = {
	"@rollup/plugin-commonjs": "^14.0.0",
	"@rollup/plugin-json": "^4.1.0",
	"@rollup/plugin-node-resolve": "^8.0.0",
	"@types/jest": "^26.0.23",
	"@wessberg/rollup-plugin-ts": "^1.3.6",
	jest: "^26.6.3",
	rollup: "^2.10.9",
	"rollup-plugin-dts": "^5.2.0",
	"ts-jest": "^26.5.5",
	"ts-node": "^9.1.1",
	typescript: "^4.0.3"
};
var dependencies = {
	arg: "^4.1.3",
	chalk: "^4.1.0"
};
var files = [
	"bin",
	"dist"
];
var pkg = {
	name: name,
	version: version,
	description: description,
	homepage: homepage,
	repository: repository,
	bugs: bugs,
	main: main,
	module: module$1,
	bin: bin,
	scripts: scripts,
	author: author,
	license: license,
	devDependencies: devDependencies,
	dependencies: dependencies,
	files: files
};

function info(message) {
    console.log(source `{cyan INFO:} ${message}`);
}
function error(message) {
    console.log(source `{red ERROR:} ${message}`);
}
function display(message) {
    console.log(source `{bold.white ${message}}`);
}
function showHelp() {
    console.log(source `
	{bold.cyan moment-guess} - {blue Utility for guessing date's format}

	{bold USAGE}

	{bold $} {cyan npx moment-guess} --date {yellow 2020-10-10}
	{bold $} {cyan npx moment-guess} --date "{yellow 31st Dec, 2020}" --format {blue default}
	{bold $} {cyan npx moment-guess} --date "{yellow Mon, 06 Mar 2017 21:00:00 +0000}" --format {blue strftime}
	{bold $} {cyan npx moment-guess} --version
	{bold $} {cyan npx moment-guess} --help

	{bold OPTIONS}

	-h, --help                          Shows this help message

	-v, --version                       Displays the current version of moment-guess

	-d, --date                          Displays the provided date's format

	-f, --format                        (optional)Format to display, can be one of "strftime" or "default"
					    To be used in conjunction with --date
	`);
}
function showUsage() {
    console.log(source `
	{bold USAGE}

	{bold $} {cyan npx moment-guess} --date {yellow 2020-10-10}
	{bold $} {cyan npx moment-guess} --version
	{bold $} {cyan npx moment-guess} --help
	`);
}
function showVersion() {
    console.log(source `{bold.white ${pkg.version}}`);
}

(function () {
    let args;
    let date;
    let format;
    try {
        args = arg_1({
            '--help': Boolean,
            '--version': Boolean,
            '--date': String,
            '--format': String,
            '-h': '--help',
            '-v': '--version',
            '-d': '--date',
            '-f': '--format',
        });
        if (args['--help']) {
            return showHelp();
        }
        if (args['--version']) {
            return showVersion();
        }
        if (args['--date']) {
            date = args['--date'];
        }
        if (args['--format']) {
            format = args['--format'];
        }
        if (!date) {
            error('Missing date!');
            return showUsage();
        }
        const res = guessFormat(date, format);
        if (res instanceof Array) {
            info('Multiple formats matched!\n');
            return res.forEach(f => display(f));
        }
        display(res);
    }
    catch (err) {
        error(err.message);
        process.exit(1);
    }
})();
