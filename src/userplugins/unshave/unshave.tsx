import { unshave as unshave_legacy } from "./unshave-legacy";

let tsv = require("tsv");
tsv.header = false;

export type UnshaveEntry = {
    shavian: string;
    latin: string;
    occurances: number;
};

export let dictionary = new Array<UnshaveEntry>();
let split_regex = /([^\u{10450}-\u{1047f}]*)([\u{10450}-\u{1047f}]+)(?:\[([\w.,']+)\])?([^\u{10450}-\u{1047f}]*)/gu;

(async function () {
    let res = await fetch("https://raw.githubusercontent.com/Shavian-info/readlex/main/kingsleyreadlexicon.tsv");
    let body = await res.text();
    for (let data of tsv.parse(body)) {
        let latin = data[0];
        let shavian = data[1];
        let occurances = +data[4];

        if (latin != undefined && shavian != undefined && occurances != undefined) {
            dictionary.push({ latin, shavian, occurances });
        }
    }
})();

function searchDict(word: string): string | undefined {
    let matches = dictionary.filter(v => v.shavian == word);
    matches.sort((a, b) => b.occurances - a.occurances);

    if (matches.length > 0) {
        return matches[0].latin;
    }
}

/// Returns original and unshaved strings
export function unshave(text: string): { original: string, unshaved: string, legacy_ranges: [number, number][]; } {
    let original = text.replaceAll(split_regex, (_, pre, word, __, aff) => {
        return pre + word + aff;
    });

    let unshaved = text.replaceAll(split_regex,
        (_, pre: string, word: string, repl: string | undefined, aff: string, index: number) => {
            return pre + (repl ?? searchDict(word) ?? `\0${unshave_legacy(word)}\0`) + aff;
        });

    let legacy_ranges = [] as [number, number][];
    let offset = 0;
    unshaved = unshaved.replaceAll(/\0(.*)\0/g, (whole, text, index) => {
        offset -= 2;
        legacy_ranges.push([index, index + whole.length - offset]);
        return text;
    });

    return { original, unshaved, legacy_ranges };
}
