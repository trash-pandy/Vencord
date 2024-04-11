let shav2lat = new Map([
    ["𐑐", "p"],
    ["𐑑", "t"],
    ["𐑒", "c"],
    ["𐑓", "f"],
    ["𐑔", "th"],
    ["𐑕", "s"],
    ["𐑖", "sh"],
    ["𐑗", "ch"],
    ["𐑘", "y"],
    ["𐑙", "ng"],
    ["𐑚", "b"],
    ["𐑛", "d"],
    ["𐑜", "g"],
    ["𐑝", "v"],
    ["𐑞", "th"],
    ["𐑟", "s"],
    ["𐑠", "sh"],
    ["𐑡", "j"],
    ["𐑢", "w"],
    ["𐑣", "h"],
    ["𐑤", "l"],
    ["𐑮", "r"],
    ["𐑥", "m"],
    ["𐑯", "n"],
    ["𐑦", "i"],
    ["𐑰", "ee"],
    ["𐑧", "e"],
    ["𐑱", "a"],
    ["𐑨", "a"],
    ["𐑲", "ai"],
    ["𐑩", "a"],
    ["𐑳", "u"],
    ["𐑪", "o"],
    ["𐑴", "o"],
    ["𐑫", "oo"],
    ["𐑵", "oo"],
    ["𐑬", "ou"],
    ["𐑶", "oi"],
    ["𐑭", "a"],
    ["𐑷", "aw"],
    ["𐑸", "ar"],
    ["𐑹", "or"],
    ["𐑺", "air"],
    ["𐑻", "er"],
    ["𐑼", "ar"],
    ["𐑽", "ear"],
    ["𐑾", "ia"],
    ["𐑿", "you"],
]);

let cl_con = "\\u{10450}-\\u{10463}";
let cl_vow = "\\u{10464}-\\u{10477}";
let regexs: [[RegExp, string]] = [
    [/^(.+)𐑒$/g, "$1k"],
    [/^(.+([𐑞𐑣𐑮]|𐑐𐑮))𐑱$/g, "$1ey"],
    [/^𐑒𐑢(.+)$/g, "qu$1"],
    [/^(.+)𐑲𐑑$/g, "$1ite"],
    [/^𐑲$/g, "i"],
    [/^(.+)𐑲𐑟$/g, "$1ise"],
    [/^𐑝$/g, "of"],
    [/^𐑯$/g, "and"],
    [/^𐑩$/g, "a"],
    [/^(.*[𐑕𐑟])𐑲𐑯$/g, "$1ign"],
    [/^(.*)𐑐𐑰𐑕$/g, "$1piece"],
    [/^𐑞$/g, "the"],
    [/^𐑑$/g, "to"],
    [/^𐑲𐑤$/g, "isle"],
    [/^𐑢𐑲𐑤$/g, "while"],
    [/^𐑢𐑲$/g, "why"],
    [/^𐑸$/g, "are"],
    [/^(.*)𐑬𐑯𐑕$/g, "$1ounce"],
    [/^(.*)𐑬𐑯𐑟$/g, "$1ouns"],
    [/^𐑧𐑒𐑕𐑧([𐑕𐑮𐑐].*)$/g, "exce$1"],
    [/^𐑧𐑒𐑕𐑻([𐑕𐑮𐑐].*)$/g, "excer$1"],
    [/^𐑧𐑒𐑕(.*)$/g, "ex$1"],
    [/^(.*)𐑧𐑒𐑕(.*)$/g, "$1x$2"],
    [/^𐑯𐑿$/g, "new"],
    [/^𐑓𐑿$/g, "few"],
    [/^𐑣𐑨𐑝$/g, "have"],
    [/^(.*)𐑦$/g, "$1y"],
    [/^𐑒𐑫𐑛$/g, "could"],
    [/^(.*)𐑹$/g, "$1ore"],
    [/^𐑒([𐑦𐑰𐑧].*)$/g, "k$1"],
    [/^(.*)𐑳𐑒$/g, "$1uck"],
    [`^(.*)𐑐𐑖([${cl_vow}].*)$`, "$1pti$2"],
    [/^(.*i)𐑳(.*)$/g, "$1o$2"],
    [/^𐑨𐑛$/g, "add"],
    [`^([${cl_con}])𐑦𐑤$`, "$1ill"],
    [/^(.*)𐑦𐑤(.+)$/g, "$1ill$2"],
    [/^𐑓(𐑩𐑴.+)$/g, "pho$1"],
    [/^(.+)𐑲𐑥$/g, "$1ime"],
    [`^(.+[${cl_vow}])𐑐([𐑧].+)$`, "$1pp$2"],
    [/^$/g, ""],
] as any;

regexs.forEach((v, i) => {
    let [exp, repl] = v;
    if (!(exp instanceof RegExp)) {
        v[0] = new RegExp(exp, "gu");
    }
});

function finalize(word: string): string {
    let prefix = "";
    if (word.startsWith("·")) {
        word = word.substring(1);
        prefix += "·";
    }
    for (let [regex, replace] of regexs) {
        let old = word;
        word = word.replace(regex, replace);
        if (word !== old) {
            console.log(`${old} became ${word}`);
            console.log(`${regex}: ${replace}`);
        }
    }

    return prefix + word;
}

export function unshave(text: string): string {
    let split_regex = /([^\s]+)(\s*)/g;
    let words = text.matchAll(split_regex);
    let rejoin: string[] = [];
    for (let match of words) {
        let word = [...finalize(match[1])];

        for (let j in word) {
            let codepoint = word[j];
            let replacement = shav2lat.get(codepoint);
            if (replacement !== undefined) {
                word[j] = replacement;
            }
        }

        rejoin.push(word.join(""), match[2]);
    }
    return rejoin.join("");
}
