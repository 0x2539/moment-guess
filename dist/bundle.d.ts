type Date = string;
type Format = string;
declare function guessFormat(date: Date, format?: string): Array<Format> | Format;

export default guessFormat;
