# PDF receipt fonts

PDF receipts use static Noto Sans JP 400 and 700 TrueType subsets so English digits and Japanese text render in the same PDF. The browser uses the variable Fontsource package separately.

- Source: `@fontsource/noto-sans-jp` **5.3.1**, published under the SIL Open Font License 1.1.
- Files: `noto-sans-jp-japanese-{400,700}-normal.ttf` and `noto-sans-jp-latin-{400,700}-normal.ttf`.
- The static WOFF2 subsets were fetched from the immutable `@5.3.1` npm package and converted to TTF with FontTools **4.67.0** for Forme's font embedding API.
- The license is included as [OFL-1.1.txt](OFL-1.1.txt).

SHA-256:

| File                                   | SHA-256                                                            |
| -------------------------------------- | ------------------------------------------------------------------ |
| `noto-sans-jp-japanese-400-normal.ttf` | `7c52470227634f29f63eb845c7a33864cccf92e0ceff4c4b47bee128d5d103d8` |
| `noto-sans-jp-japanese-700-normal.ttf` | `a4aa9ab8998a9401aa142f000cbdadc8ddff53027f205bf759c7057bef2bcb86` |
| `noto-sans-jp-latin-400-normal.ttf`    | `2019b18df9e93d34f4164ae6ad19ab90418e81f31b2c231e4ada408ccda68f21` |
| `noto-sans-jp-latin-700-normal.ttf`    | `682ba386687b883b51672763c38a00a3c890a49ce201b45c56110301651967c1` |
