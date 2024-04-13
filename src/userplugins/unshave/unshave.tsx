import { unshave as unshave_legacy } from "./unshave-legacy";
import tsv from "tsv";

let tsv_parser = new tsv.Parser("\t", { header: false });

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
    for (let data of tsv_parser.parse(body)) {
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

    let offset = 0;
    let legacy_ranges = [] as [number, number][];
    let unshaved = text.replaceAll(split_regex,
        (match, pre: string, word: string, repl: string | undefined, aff: string, index: number) => {
            let legacy = false;
            let replacement = (repl ?? searchDict(word) ?? (legacy = true, unshave_legacy(word)));
            let result = pre + replacement + aff;
            if (legacy) {
                let start = index + pre.length - offset;
                legacy_ranges.push([start, start + replacement.length]);
            }
            offset += match.length - result.length;
            return result;
        });

    return { original, unshaved, legacy_ranges };
}
