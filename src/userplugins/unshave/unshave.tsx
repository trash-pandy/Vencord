import { unshave as unshave_legacy } from "./unshave-legacy";

let tsv = require("tsv");
tsv.header = false;

export type UnshaveEntry = {
    shavian: string;
    latin: string;
    occurances: number;
};

export class Unshave {
    entries = new Array<UnshaveEntry>();

    async load() {
        let res = await fetch("https://raw.githubusercontent.com/Shavian-info/readlex/main/kingsleyreadlexicon.tsv");
        let body = await res.text();

        let occurance_map = new Map<string, number>();
        for (let data of tsv.parse(body)) {
            let latin = data[0];
            let shavian = data[1];
            let occurances = +data[4];

            if (latin != undefined && shavian != undefined && occurances != undefined) {
                this.entries.push({ latin, shavian, occurances });
            }
        }
    }

    private searchDict(word: string): string | undefined {
        let matches = this.entries.filter(v => v.shavian == word);
        matches.sort((a, b) => b.occurances - a.occurances);

        if (matches.length > 0) {
            return matches[0].latin;
        }
    }

    /// Returns original and unshaved strings
    process(text: string): [string, string] {
        let split_regex = /([^\u{10450}-\u{1047f}]*)([\u{10450}-\u{1047f}]+)(?:\[([\w.,']+)\])?([^\u{10450}-\u{1047f}]*)/gu;
        let original = text.replaceAll(split_regex, (_, pre, word, __, aff) => {
            return pre + word + aff;
        });
        let unshaved = text.replaceAll(split_regex, (_, pre, word, repl, aff) => {
            return pre + (repl ?? this.searchDict(word) ?? unshave_legacy(word)) + aff;
        });

        return [original, unshaved];
    }

    // process(text: string): string {
    //     let split_regex = /([^\s]+)(\s*)/g;
    //     let words = text.matchAll(split_regex);
    //     let rejoin: string[] = [];
    //     for (let match of words) {
    //         let [_, word, space] = match;

    //         let prefix = "";
    //         let affix = "";
    //         if (word.startsWith("·")) {
    //             word = word.substring(1);
    //             prefix += "·";
    //         }
    //         word = word.replace(/^([^\u{10450}-\u{1047f}]*)([\u{10450}-\u{1047f}]+)(\[[\w.,']+\])([^\u{10450}-\u{1047f}]*)$/gu, (match, word_prefix, word, substitute, word_affix) => {
    //             prefix += word_prefix;
    //             affix += word_affix;
    //             if (substitute !== "") {
    //                 return substitute;
    //             } else {
    //                 return word;
    //             }
    //         });
    //         if (word.startsWith("·")) {
    //             word = word.substring(1);
    //             prefix += "·";
    //         }

    //         let dict_word = this.dict[word];
    //         if (dict_word !== undefined) {
    //             word = dict_word;
    //         } else {
    //             word = unshave_legacy(word);
    //         }

    //         rejoin.push(prefix, word, affix, space);
    //     }
    //     return rejoin.join("");
    // }
}
