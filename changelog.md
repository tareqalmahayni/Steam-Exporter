| Sheet | Cell | Game | Metric | Date/Week | Old | New | Status | Reason |
|---|---|---|---|---|---|---|---|---|
| KPI by Quarter | A10 | petunia | label | — | Putania's Purgatory | Petunia's Purgatory | write | typo-fix: Putania → Petunia |
| KPI by Quarter | A27 | petunia | label | — | Putania's Purgatory | Petunia's Purgatory | write | typo-fix: Putania → Petunia |
| KPI by Quarter | A44 | petunia | label | — | Putania's Purgatory | Petunia's Purgatory | write | typo-fix: Putania → Petunia |
| KPI by Quarter | A61 | petunia | label | — | Putania's Purgatory | Petunia's Purgatory | write | typo-fix: Putania → Petunia |
| Consolidated KPI | A10 | petunia | label | — | Putania's Purgatory - Wishlists | Petunia's Purgatory - Wishlists | write | typo-fix: Putania → Petunia |
| Consolidated KPI | A11 | petunia | label | — | Putania's Purgatory - Impressions | Petunia's Purgatory - Impressions | write | typo-fix: Putania → Petunia |
| Consolidated KPI | A12 | petunia | label | — | Putania's Purgatory - Visits | Petunia's Purgatory - Visits | write | typo-fix: Putania → Petunia |
| Dashboard | L4 | petunia | label | — | Putania's Purgatory | Petunia's Purgatory | write | typo-fix: Putania → Petunia |
| Dashboard | E31 | petunia | label | — | =IF($B$3="All Games","Putania's Purgatory","") | =IF($B$3="All Games","Putania's Purgatory","") | skip-formula-target | typo-fix: label cell is a formula — refusing |
| Noor_WL | A1 | noor | structure | — |  | DateLocal | write | add-noor: WL header row |
| Noor_WL | B1 | noor | structure | — |  | Game | write | add-noor: WL header row |
| Noor_WL | C1 | noor | structure | — |  | Adds | write | add-noor: WL header row |
| Noor_WL | D1 | noor | structure | — |  | Deletes | write | add-noor: WL header row |
| Noor_WL | E1 | noor | structure | — |  | Purchases And Activations | write | add-noor: WL header row |
| Noor_WL | F1 | noor | structure | — |  | Gifts | write | add-noor: WL header row |
| Noor_WL | G1 | noor | structure | — |  | Net Wishlist | write | add-noor: WL header row |
| Noor_WL | H1 | noor | structure | — |  | Weekly Net | write | add-noor: WL header row |
| Noor_WL | I1 | noor | structure | — |  | Monthly Net | write | add-noor: WL header row |
| KPI by Quarter | A70 | noor | structure | — |  | Noor | write | add-noor: header label |
| KPI by Quarter | B70 | noor | structure | — |  | 1/4 | write | add-noor: header date col 1 |
| KPI by Quarter | C70 | noor | structure | — |  | 1/11 | write | add-noor: header date col 2 |
| KPI by Quarter | D70 | noor | structure | — |  | 1/18 | write | add-noor: header date col 3 |
| KPI by Quarter | E70 | noor | structure | — |  | 1/25 | write | add-noor: header date col 4 |
| KPI by Quarter | F70 | noor | structure | — |  | 2/1 | write | add-noor: header date col 5 |
| KPI by Quarter | G70 | noor | structure | — |  | 2/8 | write | add-noor: header date col 6 |
| KPI by Quarter | H70 | noor | structure | — |  | 2/15 | write | add-noor: header date col 7 |
| KPI by Quarter | I70 | noor | structure | — |  | 2/22 | write | add-noor: header date col 8 |
| KPI by Quarter | J70 | noor | structure | — |  | 3/1 | write | add-noor: header date col 9 |
| KPI by Quarter | K70 | noor | structure | — |  | 3/8 | write | add-noor: header date col 10 |
| KPI by Quarter | L70 | noor | structure | — |  | 3/15 | write | add-noor: header date col 11 |
| KPI by Quarter | M70 | noor | structure | — |  | 3/22 | write | add-noor: header date col 12 |
| KPI by Quarter | N70 | noor | structure | — |  | 3/29 | write | add-noor: header date col 13 |
| KPI by Quarter | O70 | noor | structure | — |  | WoW% | write | add-noor: header WoW% |
| KPI by Quarter | P70 | noor | structure | — |  | Total | write | add-noor: header Total |
| KPI by Quarter | A71 | noor | structure | — |  | Wishlists | write | add-noor: metric label |
| KPI by Quarter | B71 | noor | structure | — |  | =SUMIF('Noor_WL'!$A:$A,"<="&B70,'Noor_WL'!$H:$H) | write | add-noor: wishlists formula B |
| KPI by Quarter | C71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&B70,'Noor_WL'!$A:$A,"<="&C70) | write | add-noor: wishlists formula C |
| KPI by Quarter | D71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&C70,'Noor_WL'!$A:$A,"<="&D70) | write | add-noor: wishlists formula D |
| KPI by Quarter | E71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&D70,'Noor_WL'!$A:$A,"<="&E70) | write | add-noor: wishlists formula E |
| KPI by Quarter | F71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&E70,'Noor_WL'!$A:$A,"<="&F70) | write | add-noor: wishlists formula F |
| KPI by Quarter | G71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&F70,'Noor_WL'!$A:$A,"<="&G70) | write | add-noor: wishlists formula G |
| KPI by Quarter | H71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&G70,'Noor_WL'!$A:$A,"<="&H70) | write | add-noor: wishlists formula H |
| KPI by Quarter | I71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&H70,'Noor_WL'!$A:$A,"<="&I70) | write | add-noor: wishlists formula I |
| KPI by Quarter | J71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&I70,'Noor_WL'!$A:$A,"<="&J70) | write | add-noor: wishlists formula J |
| KPI by Quarter | K71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&J70,'Noor_WL'!$A:$A,"<="&K70) | write | add-noor: wishlists formula K |
| KPI by Quarter | L71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&K70,'Noor_WL'!$A:$A,"<="&L70) | write | add-noor: wishlists formula L |
| KPI by Quarter | M71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&L70,'Noor_WL'!$A:$A,"<="&M70) | write | add-noor: wishlists formula M |
| KPI by Quarter | N71 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&M70,'Noor_WL'!$A:$A,"<="&N70) | write | add-noor: wishlists formula N |
| KPI by Quarter | P71 | noor | structure | — |  | =SUM(B71:N71) | write | add-noor: wishlists Total formula |
| KPI by Quarter | A72 | noor | structure | — |  | Impressions | write | add-noor: metric label |
| KPI by Quarter | P72 | noor | structure | — |  | =SUM(B72:N72) | write | add-noor: impressions Total formula |
| KPI by Quarter | A73 | noor | structure | — |  | Visits | write | add-noor: metric label |
| KPI by Quarter | P73 | noor | structure | — |  | =SUM(B73:N73) | write | add-noor: visits Total formula |
| KPI by Quarter | A75 | noor | structure | — |  | Noor | write | add-noor: header label |
| KPI by Quarter | B75 | noor | structure | — |  | 4/5 | write | add-noor: header date col 1 |
| KPI by Quarter | C75 | noor | structure | — |  | 4/12 | write | add-noor: header date col 2 |
| KPI by Quarter | D75 | noor | structure | — |  | 4/19 | write | add-noor: header date col 3 |
| KPI by Quarter | E75 | noor | structure | — |  | 4/26 | write | add-noor: header date col 4 |
| KPI by Quarter | F75 | noor | structure | — |  | 5/3 | write | add-noor: header date col 5 |
| KPI by Quarter | G75 | noor | structure | — |  | 5/10 | write | add-noor: header date col 6 |
| KPI by Quarter | H75 | noor | structure | — |  | 5/16 | write | add-noor: header date col 7 |
| KPI by Quarter | I75 | noor | structure | — |  | 5/23 | write | add-noor: header date col 8 |
| KPI by Quarter | J75 | noor | structure | — |  | 5/30 | write | add-noor: header date col 9 |
| KPI by Quarter | K75 | noor | structure | — |  | 6/6 | write | add-noor: header date col 10 |
| KPI by Quarter | L75 | noor | structure | — |  | 6/13 | write | add-noor: header date col 11 |
| KPI by Quarter | M75 | noor | structure | — |  | 6/20 | write | add-noor: header date col 12 |
| KPI by Quarter | N75 | noor | structure | — |  | 6/27 | write | add-noor: header date col 13 |
| KPI by Quarter | O75 | noor | structure | — |  | WoW% | write | add-noor: header WoW% |
| KPI by Quarter | P75 | noor | structure | — |  | Total | write | add-noor: header Total |
| KPI by Quarter | A76 | noor | structure | — |  | Wishlists | write | add-noor: metric label |
| KPI by Quarter | B76 | noor | structure | — |  | =SUMIF('Noor_WL'!$A:$A,"<="&B75,'Noor_WL'!$H:$H) | write | add-noor: wishlists formula B |
| KPI by Quarter | C76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&B75,'Noor_WL'!$A:$A,"<="&C75) | write | add-noor: wishlists formula C |
| KPI by Quarter | D76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&C75,'Noor_WL'!$A:$A,"<="&D75) | write | add-noor: wishlists formula D |
| KPI by Quarter | E76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&D75,'Noor_WL'!$A:$A,"<="&E75) | write | add-noor: wishlists formula E |
| KPI by Quarter | F76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&E75,'Noor_WL'!$A:$A,"<="&F75) | write | add-noor: wishlists formula F |
| KPI by Quarter | G76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&F75,'Noor_WL'!$A:$A,"<="&G75) | write | add-noor: wishlists formula G |
| KPI by Quarter | H76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&G75,'Noor_WL'!$A:$A,"<="&H75) | write | add-noor: wishlists formula H |
| KPI by Quarter | I76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&H75,'Noor_WL'!$A:$A,"<="&I75) | write | add-noor: wishlists formula I |
| KPI by Quarter | J76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&I75,'Noor_WL'!$A:$A,"<="&J75) | write | add-noor: wishlists formula J |
| KPI by Quarter | K76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&J75,'Noor_WL'!$A:$A,"<="&K75) | write | add-noor: wishlists formula K |
| KPI by Quarter | L76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&K75,'Noor_WL'!$A:$A,"<="&L75) | write | add-noor: wishlists formula L |
| KPI by Quarter | M76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&L75,'Noor_WL'!$A:$A,"<="&M75) | write | add-noor: wishlists formula M |
| KPI by Quarter | N76 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&M75,'Noor_WL'!$A:$A,"<="&N75) | write | add-noor: wishlists formula N |
| KPI by Quarter | P76 | noor | structure | — |  | =SUM(B76:N76) | write | add-noor: wishlists Total formula |
| KPI by Quarter | A77 | noor | structure | — |  | Impressions | write | add-noor: metric label |
| KPI by Quarter | P77 | noor | structure | — |  | =SUM(B77:N77) | write | add-noor: impressions Total formula |
| KPI by Quarter | A78 | noor | structure | — |  | Visits | write | add-noor: metric label |
| KPI by Quarter | P78 | noor | structure | — |  | =SUM(B78:N78) | write | add-noor: visits Total formula |
| KPI by Quarter | A80 | noor | structure | — |  | Noor | write | add-noor: header label |
| KPI by Quarter | B80 | noor | structure | — |  | 7/4 | write | add-noor: header date col 1 |
| KPI by Quarter | C80 | noor | structure | — |  | 7/11 | write | add-noor: header date col 2 |
| KPI by Quarter | D80 | noor | structure | — |  | 7/18 | write | add-noor: header date col 3 |
| KPI by Quarter | E80 | noor | structure | — |  | 7/25 | write | add-noor: header date col 4 |
| KPI by Quarter | F80 | noor | structure | — |  | 8/1 | write | add-noor: header date col 5 |
| KPI by Quarter | G80 | noor | structure | — |  | 8/8 | write | add-noor: header date col 6 |
| KPI by Quarter | H80 | noor | structure | — |  | 8/15 | write | add-noor: header date col 7 |
| KPI by Quarter | I80 | noor | structure | — |  | 8/22 | write | add-noor: header date col 8 |
| KPI by Quarter | J80 | noor | structure | — |  | 8/29 | write | add-noor: header date col 9 |
| KPI by Quarter | K80 | noor | structure | — |  | 9/5 | write | add-noor: header date col 10 |
| KPI by Quarter | L80 | noor | structure | — |  | 9/12 | write | add-noor: header date col 11 |
| KPI by Quarter | M80 | noor | structure | — |  | 9/19 | write | add-noor: header date col 12 |
| KPI by Quarter | N80 | noor | structure | — |  | 9/26 | write | add-noor: header date col 13 |
| KPI by Quarter | O80 | noor | structure | — |  | WoW% | write | add-noor: header WoW% |
| KPI by Quarter | P80 | noor | structure | — |  | Total | write | add-noor: header Total |
| KPI by Quarter | A81 | noor | structure | — |  | Wishlists | write | add-noor: metric label |
| KPI by Quarter | B81 | noor | structure | — |  | =SUMIF('Noor_WL'!$A:$A,"<="&B80,'Noor_WL'!$H:$H) | write | add-noor: wishlists formula B |
| KPI by Quarter | C81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&B80,'Noor_WL'!$A:$A,"<="&C80) | write | add-noor: wishlists formula C |
| KPI by Quarter | D81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&C80,'Noor_WL'!$A:$A,"<="&D80) | write | add-noor: wishlists formula D |
| KPI by Quarter | E81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&D80,'Noor_WL'!$A:$A,"<="&E80) | write | add-noor: wishlists formula E |
| KPI by Quarter | F81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&E80,'Noor_WL'!$A:$A,"<="&F80) | write | add-noor: wishlists formula F |
| KPI by Quarter | G81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&F80,'Noor_WL'!$A:$A,"<="&G80) | write | add-noor: wishlists formula G |
| KPI by Quarter | H81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&G80,'Noor_WL'!$A:$A,"<="&H80) | write | add-noor: wishlists formula H |
| KPI by Quarter | I81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&H80,'Noor_WL'!$A:$A,"<="&I80) | write | add-noor: wishlists formula I |
| KPI by Quarter | J81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&I80,'Noor_WL'!$A:$A,"<="&J80) | write | add-noor: wishlists formula J |
| KPI by Quarter | K81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&J80,'Noor_WL'!$A:$A,"<="&K80) | write | add-noor: wishlists formula K |
| KPI by Quarter | L81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&K80,'Noor_WL'!$A:$A,"<="&L80) | write | add-noor: wishlists formula L |
| KPI by Quarter | M81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&L80,'Noor_WL'!$A:$A,"<="&M80) | write | add-noor: wishlists formula M |
| KPI by Quarter | N81 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&M80,'Noor_WL'!$A:$A,"<="&N80) | write | add-noor: wishlists formula N |
| KPI by Quarter | P81 | noor | structure | — |  | =SUM(B81:N81) | write | add-noor: wishlists Total formula |
| KPI by Quarter | A82 | noor | structure | — |  | Impressions | write | add-noor: metric label |
| KPI by Quarter | P82 | noor | structure | — |  | =SUM(B82:N82) | write | add-noor: impressions Total formula |
| KPI by Quarter | A83 | noor | structure | — |  | Visits | write | add-noor: metric label |
| KPI by Quarter | P83 | noor | structure | — |  | =SUM(B83:N83) | write | add-noor: visits Total formula |
| KPI by Quarter | A85 | noor | structure | — |  | Noor | write | add-noor: header label |
| KPI by Quarter | B85 | noor | structure | — |  | 10/3 | write | add-noor: header date col 1 |
| KPI by Quarter | C85 | noor | structure | — |  | 10/10 | write | add-noor: header date col 2 |
| KPI by Quarter | D85 | noor | structure | — |  | 10/17 | write | add-noor: header date col 3 |
| KPI by Quarter | E85 | noor | structure | — |  | 10/24 | write | add-noor: header date col 4 |
| KPI by Quarter | F85 | noor | structure | — |  | 10/31 | write | add-noor: header date col 5 |
| KPI by Quarter | G85 | noor | structure | — |  | 11/7 | write | add-noor: header date col 6 |
| KPI by Quarter | H85 | noor | structure | — |  | 11/14 | write | add-noor: header date col 7 |
| KPI by Quarter | I85 | noor | structure | — |  | 11/21 | write | add-noor: header date col 8 |
| KPI by Quarter | J85 | noor | structure | — |  | 11/28 | write | add-noor: header date col 9 |
| KPI by Quarter | K85 | noor | structure | — |  | 12/5 | write | add-noor: header date col 10 |
| KPI by Quarter | L85 | noor | structure | — |  | 12/12 | write | add-noor: header date col 11 |
| KPI by Quarter | M85 | noor | structure | — |  | 12/19 | write | add-noor: header date col 12 |
| KPI by Quarter | N85 | noor | structure | — |  | 12/26 | write | add-noor: header date col 13 |
| KPI by Quarter | O85 | noor | structure | — |  | WoW% | write | add-noor: header WoW% |
| KPI by Quarter | P85 | noor | structure | — |  | Total | write | add-noor: header Total |
| KPI by Quarter | A86 | noor | structure | — |  | Wishlists | write | add-noor: metric label |
| KPI by Quarter | B86 | noor | structure | — |  | =SUMIF('Noor_WL'!$A:$A,"<="&B85,'Noor_WL'!$H:$H) | write | add-noor: wishlists formula B |
| KPI by Quarter | C86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&B85,'Noor_WL'!$A:$A,"<="&C85) | write | add-noor: wishlists formula C |
| KPI by Quarter | D86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&C85,'Noor_WL'!$A:$A,"<="&D85) | write | add-noor: wishlists formula D |
| KPI by Quarter | E86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&D85,'Noor_WL'!$A:$A,"<="&E85) | write | add-noor: wishlists formula E |
| KPI by Quarter | F86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&E85,'Noor_WL'!$A:$A,"<="&F85) | write | add-noor: wishlists formula F |
| KPI by Quarter | G86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&F85,'Noor_WL'!$A:$A,"<="&G85) | write | add-noor: wishlists formula G |
| KPI by Quarter | H86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&G85,'Noor_WL'!$A:$A,"<="&H85) | write | add-noor: wishlists formula H |
| KPI by Quarter | I86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&H85,'Noor_WL'!$A:$A,"<="&I85) | write | add-noor: wishlists formula I |
| KPI by Quarter | J86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&I85,'Noor_WL'!$A:$A,"<="&J85) | write | add-noor: wishlists formula J |
| KPI by Quarter | K86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&J85,'Noor_WL'!$A:$A,"<="&K85) | write | add-noor: wishlists formula K |
| KPI by Quarter | L86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&K85,'Noor_WL'!$A:$A,"<="&L85) | write | add-noor: wishlists formula L |
| KPI by Quarter | M86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&L85,'Noor_WL'!$A:$A,"<="&M85) | write | add-noor: wishlists formula M |
| KPI by Quarter | N86 | noor | structure | — |  | =SUMIFS('Noor_WL'!$H:$H,'Noor_WL'!$A:$A,">"&M85,'Noor_WL'!$A:$A,"<="&N85) | write | add-noor: wishlists formula N |
| KPI by Quarter | P86 | noor | structure | — |  | =SUM(B86:N86) | write | add-noor: wishlists Total formula |
| KPI by Quarter | A87 | noor | structure | — |  | Impressions | write | add-noor: metric label |
| KPI by Quarter | P87 | noor | structure | — |  | =SUM(B87:N87) | write | add-noor: impressions Total formula |
| KPI by Quarter | A88 | noor | structure | — |  | Visits | write | add-noor: metric label |
| KPI by Quarter | P88 | noor | structure | — |  | =SUM(B88:N88) | write | add-noor: visits Total formula |
| Consolidated KPI | A28 | noor | structure | — |  | Noor - Wishlists | write | add-noor: consolidated label |
| Consolidated KPI | A29 | noor | structure | — |  | Noor - Impressions | write | add-noor: consolidated label |
| Consolidated KPI | A30 | noor | structure | — |  | Noor - Visits | write | add-noor: consolidated label |
| Consolidated KPI | B28 | noor | structure | — |  | ='KPI by Quarter'!B71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | B29 | noor | structure | — |  | ='KPI by Quarter'!B72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | B30 | noor | structure | — |  | ='KPI by Quarter'!B73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | C28 | noor | structure | — |  | ='KPI by Quarter'!C71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | C29 | noor | structure | — |  | ='KPI by Quarter'!C72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | C30 | noor | structure | — |  | ='KPI by Quarter'!C73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | D28 | noor | structure | — |  | ='KPI by Quarter'!D71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | D29 | noor | structure | — |  | ='KPI by Quarter'!D72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | D30 | noor | structure | — |  | ='KPI by Quarter'!D73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | E28 | noor | structure | — |  | ='KPI by Quarter'!E71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | E29 | noor | structure | — |  | ='KPI by Quarter'!E72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | E30 | noor | structure | — |  | ='KPI by Quarter'!E73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | F28 | noor | structure | — |  | ='KPI by Quarter'!F71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | F29 | noor | structure | — |  | ='KPI by Quarter'!F72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | F30 | noor | structure | — |  | ='KPI by Quarter'!F73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | G28 | noor | structure | — |  | ='KPI by Quarter'!G71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | G29 | noor | structure | — |  | ='KPI by Quarter'!G72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | G30 | noor | structure | — |  | ='KPI by Quarter'!G73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | H28 | noor | structure | — |  | ='KPI by Quarter'!H71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | H29 | noor | structure | — |  | ='KPI by Quarter'!H72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | H30 | noor | structure | — |  | ='KPI by Quarter'!H73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | I28 | noor | structure | — |  | ='KPI by Quarter'!I71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | I29 | noor | structure | — |  | ='KPI by Quarter'!I72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | I30 | noor | structure | — |  | ='KPI by Quarter'!I73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | J28 | noor | structure | — |  | ='KPI by Quarter'!J71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | J29 | noor | structure | — |  | ='KPI by Quarter'!J72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | J30 | noor | structure | — |  | ='KPI by Quarter'!J73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | K28 | noor | structure | — |  | ='KPI by Quarter'!K71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | K29 | noor | structure | — |  | ='KPI by Quarter'!K72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | K30 | noor | structure | — |  | ='KPI by Quarter'!K73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | L28 | noor | structure | — |  | ='KPI by Quarter'!L71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | L29 | noor | structure | — |  | ='KPI by Quarter'!L72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | L30 | noor | structure | — |  | ='KPI by Quarter'!L73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | M28 | noor | structure | — |  | ='KPI by Quarter'!M71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | M29 | noor | structure | — |  | ='KPI by Quarter'!M72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | M30 | noor | structure | — |  | ='KPI by Quarter'!M73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | N28 | noor | structure | — |  | ='KPI by Quarter'!N71 | write | add-noor: consolidated wishlists ref |
| Consolidated KPI | N29 | noor | structure | — |  | ='KPI by Quarter'!N72 | write | add-noor: consolidated impressions ref |
| Consolidated KPI | N30 | noor | structure | — |  | ='KPI by Quarter'!N73 | write | add-noor: consolidated visits ref |
| Consolidated KPI | O28 | noor | structure | — |  | ='KPI by Quarter'!B76 | write | add-noor: consolidated Q2 wishlists ref |
| Consolidated KPI | O29 | noor | structure | — |  | ='KPI by Quarter'!B77 | write | add-noor: consolidated Q2 impressions ref |
| Consolidated KPI | O30 | noor | structure | — |  | ='KPI by Quarter'!B78 | write | add-noor: consolidated Q2 visits ref |
| Consolidated KPI | P28 | noor | structure | — |  | ='KPI by Quarter'!C76 | write | add-noor: consolidated Q2 wishlists ref |
| Consolidated KPI | P29 | noor | structure | — |  | ='KPI by Quarter'!C77 | write | add-noor: consolidated Q2 impressions ref |
| Consolidated KPI | P30 | noor | structure | — |  | ='KPI by Quarter'!C78 | write | add-noor: consolidated Q2 visits ref |
| Consolidated KPI | Q28 | noor | structure | — |  | ='KPI by Quarter'!D76 | write | add-noor: consolidated Q2 wishlists ref |
| Consolidated KPI | Q29 | noor | structure | — |  | ='KPI by Quarter'!D77 | write | add-noor: consolidated Q2 impressions ref |
| Consolidated KPI | Q30 | noor | structure | — |  | ='KPI by Quarter'!D78 | write | add-noor: consolidated Q2 visits ref |
| Consolidated KPI | R28 | noor | structure | — |  | ='KPI by Quarter'!E76 | write | add-noor: consolidated Q2 wishlists ref |
| Consolidated KPI | R29 | noor | structure | — |  | ='KPI by Quarter'!E77 | write | add-noor: consolidated Q2 impressions ref |
| Consolidated KPI | R30 | noor | structure | — |  | ='KPI by Quarter'!E78 | write | add-noor: consolidated Q2 visits ref |
| Dashboard | L6 | noor | structure | — |  | Noor | write | add-noor: dashboard game-list entry |
| Taival_WL | C92 | taival | wl.adds | 2026-04-01 | 5 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D92 | taival | wl.deletes | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | E92 | taival | wl.purchases | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F92 | taival | wl.gifts | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C93 | taival | wl.adds | 2026-04-02 | 111 | 11 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D93 | taival | wl.deletes | 2026-04-02 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E93 | taival | wl.purchases | 2026-04-02 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F93 | taival | wl.gifts | 2026-04-02 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C94 | taival | wl.adds | 2026-04-03 | 68 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D94 | taival | wl.deletes | 2026-04-03 | 3 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | E94 | taival | wl.purchases | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F94 | taival | wl.gifts | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C95 | taival | wl.adds | 2026-04-04 | 33 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D95 | taival | wl.deletes | 2026-04-04 | 1 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | E95 | taival | wl.purchases | 2026-04-04 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F95 | taival | wl.gifts | 2026-04-04 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C96 | taival | wl.adds | 2026-04-05 | 37 | 9 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D96 | taival | wl.deletes | 2026-04-05 | 3 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E96 | taival | wl.purchases | 2026-04-05 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F96 | taival | wl.gifts | 2026-04-05 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C97 | taival | wl.adds | 2026-04-06 | 41 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D97 | taival | wl.deletes | 2026-04-06 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E97 | taival | wl.purchases | 2026-04-06 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F97 | taival | wl.gifts | 2026-04-06 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C98 | taival | wl.adds | 2026-04-07 | 45 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D98 | taival | wl.deletes | 2026-04-07 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E98 | taival | wl.purchases | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F98 | taival | wl.gifts | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C99 | taival | wl.adds | 2026-04-08 | 15 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D99 | taival | wl.deletes | 2026-04-08 | 4 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E99 | taival | wl.purchases | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F99 | taival | wl.gifts | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C100 | taival | wl.adds | 2026-04-09 | 107 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D100 | taival | wl.deletes | 2026-04-09 | 4 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | E100 | taival | wl.purchases | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F100 | taival | wl.gifts | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C101 | taival | wl.adds | 2026-04-10 | 68 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D101 | taival | wl.deletes | 2026-04-10 | 2 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E101 | taival | wl.purchases | 2026-04-10 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F101 | taival | wl.gifts | 2026-04-10 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C102 | taival | wl.adds | 2026-04-11 | 60 | 7 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D102 | taival | wl.deletes | 2026-04-11 | 3 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E102 | taival | wl.purchases | 2026-04-11 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F102 | taival | wl.gifts | 2026-04-11 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C103 | taival | wl.adds | 2026-04-12 | 46 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D103 | taival | wl.deletes | 2026-04-12 | 4 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E103 | taival | wl.purchases | 2026-04-12 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F103 | taival | wl.gifts | 2026-04-12 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C104 | taival | wl.adds | 2026-04-13 | 28 | 15 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D104 | taival | wl.deletes | 2026-04-13 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E104 | taival | wl.purchases | 2026-04-13 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F104 | taival | wl.gifts | 2026-04-13 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C105 | taival | wl.adds | 2026-04-14 | 41 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D105 | taival | wl.deletes | 2026-04-14 | 1 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | E105 | taival | wl.purchases | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F105 | taival | wl.gifts | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C106 | taival | wl.adds | 2026-04-15 | 58 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D106 | taival | wl.deletes | 2026-04-15 | 6 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E106 | taival | wl.purchases | 2026-04-15 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | F106 | taival | wl.gifts | 2026-04-15 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C107 | taival | wl.adds | 2026-04-16 | 233 | 5 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D107 | taival | wl.deletes | 2026-04-16 | 3 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E107 | taival | wl.purchases | 2026-04-16 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F107 | taival | wl.gifts | 2026-04-16 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C108 | taival | wl.adds | 2026-04-17 | 153 | 11 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D108 | taival | wl.deletes | 2026-04-17 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E108 | taival | wl.purchases | 2026-04-17 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F108 | taival | wl.gifts | 2026-04-17 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C109 | taival | wl.adds | 2026-04-18 | 75 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D109 | taival | wl.deletes | 2026-04-18 | 5 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E109 | taival | wl.purchases | 2026-04-18 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F109 | taival | wl.gifts | 2026-04-18 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C110 | taival | wl.adds | 2026-04-19 | 101 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D110 | taival | wl.deletes | 2026-04-19 | 4 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E110 | taival | wl.purchases | 2026-04-19 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F110 | taival | wl.gifts | 2026-04-19 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C111 | taival | wl.adds | 2026-04-20 | 1254 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D111 | taival | wl.deletes | 2026-04-20 | 7 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | E111 | taival | wl.purchases | 2026-04-20 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | F111 | taival | wl.gifts | 2026-04-20 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C112 | taival | wl.adds | 2026-04-21 | 311 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D112 | taival | wl.deletes | 2026-04-21 | 4 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E112 | taival | wl.purchases | 2026-04-21 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F112 | taival | wl.gifts | 2026-04-21 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C113 | taival | wl.adds | 2026-04-22 | 117 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D113 | taival | wl.deletes | 2026-04-22 | 1 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | E113 | taival | wl.purchases | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F113 | taival | wl.gifts | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C114 | taival | wl.adds | 2026-04-23 | 124 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D114 | taival | wl.deletes | 2026-04-23 | 5 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E114 | taival | wl.purchases | 2026-04-23 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F114 | taival | wl.gifts | 2026-04-23 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C115 | taival | wl.adds | 2026-04-24 | 749 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D115 | taival | wl.deletes | 2026-04-24 | 11 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E115 | taival | wl.purchases | 2026-04-24 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F115 | taival | wl.gifts | 2026-04-24 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C116 | taival | wl.adds | 2026-04-25 | 458 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D116 | taival | wl.deletes | 2026-04-25 | 10 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E116 | taival | wl.purchases | 2026-04-25 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F116 | taival | wl.gifts | 2026-04-25 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C117 | taival | wl.adds | 2026-04-26 | 224 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D117 | taival | wl.deletes | 2026-04-26 | 13 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E117 | taival | wl.purchases | 2026-04-26 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F117 | taival | wl.gifts | 2026-04-26 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C118 | taival | wl.adds | 2026-04-27 | 171 | 6 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D118 | taival | wl.deletes | 2026-04-27 | 15 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E118 | taival | wl.purchases | 2026-04-27 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F118 | taival | wl.gifts | 2026-04-27 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C119 | taival | wl.adds | 2026-04-28 | 155 | 9 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D119 | taival | wl.deletes | 2026-04-28 | 6 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E119 | taival | wl.purchases | 2026-04-28 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F119 | taival | wl.gifts | 2026-04-28 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C120 | taival | wl.adds | 2026-04-29 | 184 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D120 | taival | wl.deletes | 2026-04-29 | 9 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E120 | taival | wl.purchases | 2026-04-29 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F120 | taival | wl.gifts | 2026-04-29 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | C121 | taival | wl.adds | 2026-04-30 | 132 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | D121 | taival | wl.deletes | 2026-04-30 | 3 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Taival_WL | E121 | taival | wl.purchases | 2026-04-30 | 0 | 0 | skip-zero | incoming number is 0 |
| Taival_WL | F121 | taival | wl.gifts | 2026-04-30 | 0 | 0 | skip-zero | incoming number is 0 |
| KPI by Quarter | B21 | taival | impressions | 2026-04-05 (Q2) | 3697 | 4650 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | B22 | taival | visits | 2026-04-05 (Q2) | 1276 | 716 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | C21 | taival | impressions | 2026-04-12 (Q2) | 4970 | 6684 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | C22 | taival | visits | 2026-04-12 (Q2) | 2020 | 1110 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | D21 | taival | impressions | 2026-04-19 (Q2) | 14388 | 4796 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | D22 | taival | visits | 2026-04-19 (Q2) | 2147 | 839 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | E21 | taival | impressions | 2026-04-26 (Q2) | 16730 | 7066 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | E22 | taival | visits | 2026-04-26 (Q2) | 14587 | 1189 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | F21 | taival | impressions | 2026-05-03 (Q2) | 14879 | 2847 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | F22 | taival | visits | 2026-05-03 (Q2) | 6087 | 579 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | C92 | colossus | wl.adds | 2026-04-01 | 11 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D92 | colossus | wl.deletes | 2026-04-01 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E92 | colossus | wl.purchases | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F92 | colossus | wl.gifts | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C93 | colossus | wl.adds | 2026-04-02 | 31 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D93 | colossus | wl.deletes | 2026-04-02 | 5 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E93 | colossus | wl.purchases | 2026-04-02 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F93 | colossus | wl.gifts | 2026-04-02 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C94 | colossus | wl.adds | 2026-04-03 | 14 | 5 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D94 | colossus | wl.deletes | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E94 | colossus | wl.purchases | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F94 | colossus | wl.gifts | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C95 | colossus | wl.adds | 2026-04-04 | 7 | 15 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D95 | colossus | wl.deletes | 2026-04-04 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E95 | colossus | wl.purchases | 2026-04-04 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F95 | colossus | wl.gifts | 2026-04-04 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C96 | colossus | wl.adds | 2026-04-05 | 11 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D96 | colossus | wl.deletes | 2026-04-05 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E96 | colossus | wl.purchases | 2026-04-05 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F96 | colossus | wl.gifts | 2026-04-05 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C97 | colossus | wl.adds | 2026-04-06 | 7 | 7 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D97 | colossus | wl.deletes | 2026-04-06 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E97 | colossus | wl.purchases | 2026-04-06 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | F97 | colossus | wl.gifts | 2026-04-06 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C98 | colossus | wl.adds | 2026-04-07 | 10 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D98 | colossus | wl.deletes | 2026-04-07 | 1 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E98 | colossus | wl.purchases | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F98 | colossus | wl.gifts | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C99 | colossus | wl.adds | 2026-04-08 | 10 | 5 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D99 | colossus | wl.deletes | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E99 | colossus | wl.purchases | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F99 | colossus | wl.gifts | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C100 | colossus | wl.adds | 2026-04-09 | 20 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D100 | colossus | wl.deletes | 2026-04-09 | 2 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E100 | colossus | wl.purchases | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F100 | colossus | wl.gifts | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C101 | colossus | wl.adds | 2026-04-10 | 12 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D101 | colossus | wl.deletes | 2026-04-10 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E101 | colossus | wl.purchases | 2026-04-10 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F101 | colossus | wl.gifts | 2026-04-10 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C102 | colossus | wl.adds | 2026-04-11 | 30 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D102 | colossus | wl.deletes | 2026-04-11 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E102 | colossus | wl.purchases | 2026-04-11 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F102 | colossus | wl.gifts | 2026-04-11 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C103 | colossus | wl.adds | 2026-04-12 | 10 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D103 | colossus | wl.deletes | 2026-04-12 | 2 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E103 | colossus | wl.purchases | 2026-04-12 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F103 | colossus | wl.gifts | 2026-04-12 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C104 | colossus | wl.adds | 2026-04-13 | 7 | 7 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D104 | colossus | wl.deletes | 2026-04-13 | 2 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E104 | colossus | wl.purchases | 2026-04-13 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F104 | colossus | wl.gifts | 2026-04-13 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C105 | colossus | wl.adds | 2026-04-14 | 38 | 11 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D105 | colossus | wl.deletes | 2026-04-14 | 1 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E105 | colossus | wl.purchases | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F105 | colossus | wl.gifts | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C106 | colossus | wl.adds | 2026-04-15 | 80 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D106 | colossus | wl.deletes | 2026-04-15 | 5 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E106 | colossus | wl.purchases | 2026-04-15 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F106 | colossus | wl.gifts | 2026-04-15 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C107 | colossus | wl.adds | 2026-04-16 | 106 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D107 | colossus | wl.deletes | 2026-04-16 | 1 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E107 | colossus | wl.purchases | 2026-04-16 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F107 | colossus | wl.gifts | 2026-04-16 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C108 | colossus | wl.adds | 2026-04-17 | 38 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D108 | colossus | wl.deletes | 2026-04-17 | 1 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E108 | colossus | wl.purchases | 2026-04-17 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F108 | colossus | wl.gifts | 2026-04-17 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C109 | colossus | wl.adds | 2026-04-18 | 36 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D109 | colossus | wl.deletes | 2026-04-18 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E109 | colossus | wl.purchases | 2026-04-18 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F109 | colossus | wl.gifts | 2026-04-18 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C110 | colossus | wl.adds | 2026-04-19 | 47 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D110 | colossus | wl.deletes | 2026-04-19 | 2 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E110 | colossus | wl.purchases | 2026-04-19 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F110 | colossus | wl.gifts | 2026-04-19 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C111 | colossus | wl.adds | 2026-04-20 | 39 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D111 | colossus | wl.deletes | 2026-04-20 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E111 | colossus | wl.purchases | 2026-04-20 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F111 | colossus | wl.gifts | 2026-04-20 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C112 | colossus | wl.adds | 2026-04-21 | 34 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D112 | colossus | wl.deletes | 2026-04-21 | 2 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E112 | colossus | wl.purchases | 2026-04-21 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | F112 | colossus | wl.gifts | 2026-04-21 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C113 | colossus | wl.adds | 2026-04-22 | 168 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D113 | colossus | wl.deletes | 2026-04-22 | 2 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E113 | colossus | wl.purchases | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F113 | colossus | wl.gifts | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C114 | colossus | wl.adds | 2026-04-23 | 90 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D114 | colossus | wl.deletes | 2026-04-23 | 4 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E114 | colossus | wl.purchases | 2026-04-23 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F114 | colossus | wl.gifts | 2026-04-23 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C115 | colossus | wl.adds | 2026-04-24 | 25 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D115 | colossus | wl.deletes | 2026-04-24 | 2 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E115 | colossus | wl.purchases | 2026-04-24 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F115 | colossus | wl.gifts | 2026-04-24 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C116 | colossus | wl.adds | 2026-04-25 | 130 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D116 | colossus | wl.deletes | 2026-04-25 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E116 | colossus | wl.purchases | 2026-04-25 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F116 | colossus | wl.gifts | 2026-04-25 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C117 | colossus | wl.adds | 2026-04-26 | 44 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D117 | colossus | wl.deletes | 2026-04-26 | 3 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E117 | colossus | wl.purchases | 2026-04-26 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F117 | colossus | wl.gifts | 2026-04-26 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C118 | colossus | wl.adds | 2026-04-27 | 52 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D118 | colossus | wl.deletes | 2026-04-27 | 3 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E118 | colossus | wl.purchases | 2026-04-27 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F118 | colossus | wl.gifts | 2026-04-27 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C119 | colossus | wl.adds | 2026-04-28 | 52 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D119 | colossus | wl.deletes | 2026-04-28 | 3 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | E119 | colossus | wl.purchases | 2026-04-28 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F119 | colossus | wl.gifts | 2026-04-28 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C120 | colossus | wl.adds | 2026-04-29 | 53 | 5 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D120 | colossus | wl.deletes | 2026-04-29 | 3 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E120 | colossus | wl.purchases | 2026-04-29 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F120 | colossus | wl.gifts | 2026-04-29 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | C121 | colossus | wl.adds | 2026-04-30 | 23 | 5 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Colossus - Eternal Blight_WL | D121 | colossus | wl.deletes | 2026-04-30 | 2 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | E121 | colossus | wl.purchases | 2026-04-30 | 0 | 0 | skip-zero | incoming number is 0 |
| Colossus - Eternal Blight_WL | F121 | colossus | wl.gifts | 2026-04-30 | 0 | 0 | skip-zero | incoming number is 0 |
| KPI by Quarter | B25 | colossus | impressions | 2026-04-05 (Q2) | 3631 | 7436 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | B26 | colossus | visits | 2026-04-05 (Q2) | 887 | 520 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | C25 | colossus | impressions | 2026-04-12 (Q2) | 3253 | 8641 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | C26 | colossus | visits | 2026-04-12 (Q2) | 839 | 962 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | D25 | colossus | impressions | 2026-04-19 (Q2) | 14258 | 8802 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | D26 | colossus | visits | 2026-04-19 (Q2) | 1232 | 1072 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | E25 | colossus | impressions | 2026-04-26 (Q2) | 6946 | 7916 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | E26 | colossus | visits | 2026-04-26 (Q2) | 1542 | 1258 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | F25 | colossus | impressions | 2026-05-03 (Q2) | 7164 | 4597 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | F26 | colossus | visits | 2026-05-03 (Q2) | 1502 | 789 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | C92 | petunia | wl.adds | 2026-04-01 | 4 | 15 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D92 | petunia | wl.deletes | 2026-04-01 | 1 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E92 | petunia | wl.purchases | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F92 | petunia | wl.gifts | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C93 | petunia | wl.adds | 2026-04-02 | 13 | 5 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D93 | petunia | wl.deletes | 2026-04-02 | 1 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E93 | petunia | wl.purchases | 2026-04-02 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F93 | petunia | wl.gifts | 2026-04-02 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C94 | petunia | wl.adds | 2026-04-03 | 3 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D94 | petunia | wl.deletes | 2026-04-03 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E94 | petunia | wl.purchases | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F94 | petunia | wl.gifts | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C95 | petunia | wl.adds | 2026-04-04 | 10 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D95 | petunia | wl.deletes | 2026-04-04 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E95 | petunia | wl.purchases | 2026-04-04 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F95 | petunia | wl.gifts | 2026-04-04 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C96 | petunia | wl.adds | 2026-04-05 | 6 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D96 | petunia | wl.deletes | 2026-04-05 | 2 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E96 | petunia | wl.purchases | 2026-04-05 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F96 | petunia | wl.gifts | 2026-04-05 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C97 | petunia | wl.adds | 2026-04-06 | 15 | 15 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D97 | petunia | wl.deletes | 2026-04-06 | 1 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E97 | petunia | wl.purchases | 2026-04-06 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F97 | petunia | wl.gifts | 2026-04-06 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C98 | petunia | wl.adds | 2026-04-07 | 17 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D98 | petunia | wl.deletes | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E98 | petunia | wl.purchases | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F98 | petunia | wl.gifts | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C99 | petunia | wl.adds | 2026-04-08 | 2 | 9 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D99 | petunia | wl.deletes | 2026-04-08 | 1 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E99 | petunia | wl.purchases | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F99 | petunia | wl.gifts | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C100 | petunia | wl.adds | 2026-04-09 | 9 | 7 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D100 | petunia | wl.deletes | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E100 | petunia | wl.purchases | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F100 | petunia | wl.gifts | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C101 | petunia | wl.adds | 2026-04-10 | 2 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D101 | petunia | wl.deletes | 2026-04-10 | 1 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E101 | petunia | wl.purchases | 2026-04-10 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F101 | petunia | wl.gifts | 2026-04-10 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C102 | petunia | wl.adds | 2026-04-11 | 3 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D102 | petunia | wl.deletes | 2026-04-11 | 0 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E102 | petunia | wl.purchases | 2026-04-11 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F102 | petunia | wl.gifts | 2026-04-11 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C103 | petunia | wl.adds | 2026-04-12 | 3 | 9 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D103 | petunia | wl.deletes | 2026-04-12 | 1 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E103 | petunia | wl.purchases | 2026-04-12 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F103 | petunia | wl.gifts | 2026-04-12 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C104 | petunia | wl.adds | 2026-04-13 | 3 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D104 | petunia | wl.deletes | 2026-04-13 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E104 | petunia | wl.purchases | 2026-04-13 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F104 | petunia | wl.gifts | 2026-04-13 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C105 | petunia | wl.adds | 2026-04-14 | 5 | 9 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D105 | petunia | wl.deletes | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E105 | petunia | wl.purchases | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F105 | petunia | wl.gifts | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C106 | petunia | wl.adds | 2026-04-15 | 11 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D106 | petunia | wl.deletes | 2026-04-15 | 2 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E106 | petunia | wl.purchases | 2026-04-15 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F106 | petunia | wl.gifts | 2026-04-15 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C107 | petunia | wl.adds | 2026-04-16 | 3 | 11 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D107 | petunia | wl.deletes | 2026-04-16 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E107 | petunia | wl.purchases | 2026-04-16 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F107 | petunia | wl.gifts | 2026-04-16 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C108 | petunia | wl.adds | 2026-04-17 | 5 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D108 | petunia | wl.deletes | 2026-04-17 | 1 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E108 | petunia | wl.purchases | 2026-04-17 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F108 | petunia | wl.gifts | 2026-04-17 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C109 | petunia | wl.adds | 2026-04-18 | 1 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D109 | petunia | wl.deletes | 2026-04-18 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E109 | petunia | wl.purchases | 2026-04-18 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F109 | petunia | wl.gifts | 2026-04-18 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C110 | petunia | wl.adds | 2026-04-19 | 3 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D110 | petunia | wl.deletes | 2026-04-19 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E110 | petunia | wl.purchases | 2026-04-19 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F110 | petunia | wl.gifts | 2026-04-19 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C111 | petunia | wl.adds | 2026-04-20 | 0 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D111 | petunia | wl.deletes | 2026-04-20 | 1 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E111 | petunia | wl.purchases | 2026-04-20 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F111 | petunia | wl.gifts | 2026-04-20 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C112 | petunia | wl.adds | 2026-04-21 | 8 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D112 | petunia | wl.deletes | 2026-04-21 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E112 | petunia | wl.purchases | 2026-04-21 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F112 | petunia | wl.gifts | 2026-04-21 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C113 | petunia | wl.adds | 2026-04-22 | 8 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D113 | petunia | wl.deletes | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E113 | petunia | wl.purchases | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F113 | petunia | wl.gifts | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C114 | petunia | wl.adds | 2026-04-23 | 6 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D114 | petunia | wl.deletes | 2026-04-23 | 1 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E114 | petunia | wl.purchases | 2026-04-23 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F114 | petunia | wl.gifts | 2026-04-23 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C115 | petunia | wl.adds | 2026-04-24 | 7 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D115 | petunia | wl.deletes | 2026-04-24 | 3 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E115 | petunia | wl.purchases | 2026-04-24 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F115 | petunia | wl.gifts | 2026-04-24 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C116 | petunia | wl.adds | 2026-04-25 | 3 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D116 | petunia | wl.deletes | 2026-04-25 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E116 | petunia | wl.purchases | 2026-04-25 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F116 | petunia | wl.gifts | 2026-04-25 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C117 | petunia | wl.adds | 2026-04-26 | 2 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D117 | petunia | wl.deletes | 2026-04-26 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E117 | petunia | wl.purchases | 2026-04-26 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | F117 | petunia | wl.gifts | 2026-04-26 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C118 | petunia | wl.adds | 2026-04-27 | 3 | 5 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D118 | petunia | wl.deletes | 2026-04-27 | 4 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | E118 | petunia | wl.purchases | 2026-04-27 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F118 | petunia | wl.gifts | 2026-04-27 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C119 | petunia | wl.adds | 2026-04-28 | 2 | 7 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D119 | petunia | wl.deletes | 2026-04-28 | 0 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E119 | petunia | wl.purchases | 2026-04-28 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F119 | petunia | wl.gifts | 2026-04-28 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C120 | petunia | wl.adds | 2026-04-29 | 3 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D120 | petunia | wl.deletes | 2026-04-29 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E120 | petunia | wl.purchases | 2026-04-29 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F120 | petunia | wl.gifts | 2026-04-29 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | C121 | petunia | wl.adds | 2026-04-30 | 3 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | D121 | petunia | wl.deletes | 2026-04-30 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Petunia's Purgatory_WL | E121 | petunia | wl.purchases | 2026-04-30 | 0 | 0 | skip-zero | incoming number is 0 |
| Petunia's Purgatory_WL | F121 | petunia | wl.gifts | 2026-04-30 | 0 | 0 | skip-zero | incoming number is 0 |
| KPI by Quarter | B29 | petunia | impressions | 2026-04-05 (Q2) | 3364 | 3738 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | B30 | petunia | visits | 2026-04-05 (Q2) | 5782 | 873 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | C29 | petunia | impressions | 2026-04-12 (Q2) | 3463 | 6981 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | C30 | petunia | visits | 2026-04-12 (Q2) | 7678 | 1189 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | D29 | petunia | impressions | 2026-04-19 (Q2) | 2997 | 6959 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | D30 | petunia | visits | 2026-04-19 (Q2) | 5615 | 1074 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | E29 | petunia | impressions | 2026-04-26 (Q2) | 2844 | 5013 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | E30 | petunia | visits | 2026-04-26 (Q2) | 5242 | 1548 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | F29 | petunia | impressions | 2026-05-03 (Q2) | 2837 | 3572 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | F30 | petunia | visits | 2026-05-03 (Q2) | 7094 | 656 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | C92 | fleet | wl.adds | 2026-04-01 | 5 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D92 | fleet | wl.deletes | 2026-04-01 | 3 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E92 | fleet | wl.purchases | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F92 | fleet | wl.gifts | 2026-04-01 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C93 | fleet | wl.adds | 2026-04-02 | 9 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D93 | fleet | wl.deletes | 2026-04-02 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E93 | fleet | wl.purchases | 2026-04-02 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F93 | fleet | wl.gifts | 2026-04-02 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C94 | fleet | wl.adds | 2026-04-03 | 1 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D94 | fleet | wl.deletes | 2026-04-03 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E94 | fleet | wl.purchases | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F94 | fleet | wl.gifts | 2026-04-03 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C95 | fleet | wl.adds | 2026-04-04 | 0 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D95 | fleet | wl.deletes | 2026-04-04 | 2 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | E95 | fleet | wl.purchases | 2026-04-04 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F95 | fleet | wl.gifts | 2026-04-04 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C96 | fleet | wl.adds | 2026-04-05 | 1 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D96 | fleet | wl.deletes | 2026-04-05 | 4 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | E96 | fleet | wl.purchases | 2026-04-05 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F96 | fleet | wl.gifts | 2026-04-05 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C97 | fleet | wl.adds | 2026-04-06 | 1 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D97 | fleet | wl.deletes | 2026-04-06 | 2 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E97 | fleet | wl.purchases | 2026-04-06 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F97 | fleet | wl.gifts | 2026-04-06 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C98 | fleet | wl.adds | 2026-04-07 | 1 | 10 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D98 | fleet | wl.deletes | 2026-04-07 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E98 | fleet | wl.purchases | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F98 | fleet | wl.gifts | 2026-04-07 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C99 | fleet | wl.adds | 2026-04-08 | 1 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D99 | fleet | wl.deletes | 2026-04-08 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E99 | fleet | wl.purchases | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F99 | fleet | wl.gifts | 2026-04-08 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C100 | fleet | wl.adds | 2026-04-09 | 7 | 15 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D100 | fleet | wl.deletes | 2026-04-09 | 2 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E100 | fleet | wl.purchases | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F100 | fleet | wl.gifts | 2026-04-09 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C101 | fleet | wl.adds | 2026-04-10 | 4 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D101 | fleet | wl.deletes | 2026-04-10 | 2 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E101 | fleet | wl.purchases | 2026-04-10 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F101 | fleet | wl.gifts | 2026-04-10 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C102 | fleet | wl.adds | 2026-04-11 | 2 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D102 | fleet | wl.deletes | 2026-04-11 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E102 | fleet | wl.purchases | 2026-04-11 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | F102 | fleet | wl.gifts | 2026-04-11 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C103 | fleet | wl.adds | 2026-04-12 | 3 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D103 | fleet | wl.deletes | 2026-04-12 | 3 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | E103 | fleet | wl.purchases | 2026-04-12 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F103 | fleet | wl.gifts | 2026-04-12 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C104 | fleet | wl.adds | 2026-04-13 | 1 | 5 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D104 | fleet | wl.deletes | 2026-04-13 | 4 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E104 | fleet | wl.purchases | 2026-04-13 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F104 | fleet | wl.gifts | 2026-04-13 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C105 | fleet | wl.adds | 2026-04-14 | 1 | 7 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D105 | fleet | wl.deletes | 2026-04-14 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E105 | fleet | wl.purchases | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F105 | fleet | wl.gifts | 2026-04-14 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C106 | fleet | wl.adds | 2026-04-15 | 0 | 7 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D106 | fleet | wl.deletes | 2026-04-15 | 2 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | E106 | fleet | wl.purchases | 2026-04-15 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F106 | fleet | wl.gifts | 2026-04-15 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C107 | fleet | wl.adds | 2026-04-16 | 5 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D107 | fleet | wl.deletes | 2026-04-16 | 4 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E107 | fleet | wl.purchases | 2026-04-16 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F107 | fleet | wl.gifts | 2026-04-16 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C108 | fleet | wl.adds | 2026-04-17 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D108 | fleet | wl.deletes | 2026-04-17 | 1 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | E108 | fleet | wl.purchases | 2026-04-17 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F108 | fleet | wl.gifts | 2026-04-17 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C109 | fleet | wl.adds | 2026-04-18 | 1 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D109 | fleet | wl.deletes | 2026-04-18 | 1 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E109 | fleet | wl.purchases | 2026-04-18 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F109 | fleet | wl.gifts | 2026-04-18 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C110 | fleet | wl.adds | 2026-04-19 | 1 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D110 | fleet | wl.deletes | 2026-04-19 | 1 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | E110 | fleet | wl.purchases | 2026-04-19 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F110 | fleet | wl.gifts | 2026-04-19 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C111 | fleet | wl.adds | 2026-04-20 | 0 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D111 | fleet | wl.deletes | 2026-04-20 | 4 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E111 | fleet | wl.purchases | 2026-04-20 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F111 | fleet | wl.gifts | 2026-04-20 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C112 | fleet | wl.adds | 2026-04-21 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D112 | fleet | wl.deletes | 2026-04-21 | 1 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E112 | fleet | wl.purchases | 2026-04-21 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F112 | fleet | wl.gifts | 2026-04-21 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C113 | fleet | wl.adds | 2026-04-22 | 0 | 12 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D113 | fleet | wl.deletes | 2026-04-22 | 2 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E113 | fleet | wl.purchases | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F113 | fleet | wl.gifts | 2026-04-22 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C114 | fleet | wl.adds | 2026-04-23 | 2 | 11 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D114 | fleet | wl.deletes | 2026-04-23 | 1 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E114 | fleet | wl.purchases | 2026-04-23 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F114 | fleet | wl.gifts | 2026-04-23 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C115 | fleet | wl.adds | 2026-04-24 | 2 | 14 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D115 | fleet | wl.deletes | 2026-04-24 | 2 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E115 | fleet | wl.purchases | 2026-04-24 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F115 | fleet | wl.gifts | 2026-04-24 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C116 | fleet | wl.adds | 2026-04-25 | 1 | 13 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D116 | fleet | wl.deletes | 2026-04-25 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E116 | fleet | wl.purchases | 2026-04-25 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F116 | fleet | wl.gifts | 2026-04-25 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C117 | fleet | wl.adds | 2026-04-26 | 2 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D117 | fleet | wl.deletes | 2026-04-26 | 0 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E117 | fleet | wl.purchases | 2026-04-26 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F117 | fleet | wl.gifts | 2026-04-26 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C118 | fleet | wl.adds | 2026-04-27 | 6 | 8 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D118 | fleet | wl.deletes | 2026-04-27 | 1 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | E118 | fleet | wl.purchases | 2026-04-27 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F118 | fleet | wl.gifts | 2026-04-27 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C119 | fleet | wl.adds | 2026-04-28 | 4 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D119 | fleet | wl.deletes | 2026-04-28 | 2 | 3 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E119 | fleet | wl.purchases | 2026-04-28 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F119 | fleet | wl.gifts | 2026-04-28 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C120 | fleet | wl.adds | 2026-04-29 | 3 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D120 | fleet | wl.deletes | 2026-04-29 | 3 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E120 | fleet | wl.purchases | 2026-04-29 | 0 | 1 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | F120 | fleet | wl.gifts | 2026-04-29 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | C121 | fleet | wl.adds | 2026-04-30 | 4 | 4 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | D121 | fleet | wl.deletes | 2026-04-30 | 1 | 2 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Fleetbreakers_WL | E121 | fleet | wl.purchases | 2026-04-30 | 0 | 0 | skip-zero | incoming number is 0 |
| Fleetbreakers_WL | F121 | fleet | wl.gifts | 2026-04-30 | 0 | 0 | skip-zero | incoming number is 0 |
| KPI by Quarter | B33 | fleet | impressions | 2026-04-05 (Q2) | 3652 | 4366 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | B34 | fleet | visits | 2026-04-05 (Q2) | 783 | 939 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | C33 | fleet | impressions | 2026-04-12 (Q2) | 3825 | 7328 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | C34 | fleet | visits | 2026-04-12 (Q2) | 790 | 755 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | D33 | fleet | impressions | 2026-04-19 (Q2) | 5291 | 4922 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | D34 | fleet | visits | 2026-04-19 (Q2) | 614 | 1073 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | E33 | fleet | impressions | 2026-04-26 (Q2) | 4857 | 8013 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | E34 | fleet | visits | 2026-04-26 (Q2) | 891 | 1097 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | F33 | fleet | impressions | 2026-05-03 (Q2) | 6270 | 4091 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| KPI by Quarter | F34 | fleet | visits | 2026-05-03 (Q2) | 1106 | 791 | skip-existing-manual | preserve existing manual value (use --force-refresh to override) |
| Noor_WL | A2 | noor | wl.date | 2026-04-01 |  | 2026-04-01 | write | appended new WL row (date not in template) |
| Noor_WL | B2 | noor | wl.game | 2026-04-01 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C2 | noor | wl.adds | 2026-04-01 |  | 13 | write | wrote into empty cell |
| Noor_WL | D2 | noor | wl.deletes | 2026-04-01 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E2 | noor | wl.purchases | 2026-04-01 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F2 | noor | wl.gifts | 2026-04-01 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A3 | noor | wl.date | 2026-04-02 |  | 2026-04-02 | write | appended new WL row (date not in template) |
| Noor_WL | B3 | noor | wl.game | 2026-04-02 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C3 | noor | wl.adds | 2026-04-02 |  | 10 | write | wrote into empty cell |
| Noor_WL | D3 | noor | wl.deletes | 2026-04-02 |  | 3 | write | wrote into empty cell |
| Noor_WL | E3 | noor | wl.purchases | 2026-04-02 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F3 | noor | wl.gifts | 2026-04-02 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A4 | noor | wl.date | 2026-04-03 |  | 2026-04-03 | write | appended new WL row (date not in template) |
| Noor_WL | B4 | noor | wl.game | 2026-04-03 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C4 | noor | wl.adds | 2026-04-03 |  | 1 | write | wrote into empty cell |
| Noor_WL | D4 | noor | wl.deletes | 2026-04-03 |  | 2 | write | wrote into empty cell |
| Noor_WL | E4 | noor | wl.purchases | 2026-04-03 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F4 | noor | wl.gifts | 2026-04-03 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A5 | noor | wl.date | 2026-04-04 |  | 2026-04-04 | write | appended new WL row (date not in template) |
| Noor_WL | B5 | noor | wl.game | 2026-04-04 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C5 | noor | wl.adds | 2026-04-04 |  | 7 | write | wrote into empty cell |
| Noor_WL | D5 | noor | wl.deletes | 2026-04-04 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E5 | noor | wl.purchases | 2026-04-04 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F5 | noor | wl.gifts | 2026-04-04 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A6 | noor | wl.date | 2026-04-05 |  | 2026-04-05 | write | appended new WL row (date not in template) |
| Noor_WL | B6 | noor | wl.game | 2026-04-05 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C6 | noor | wl.adds | 2026-04-05 |  | 5 | write | wrote into empty cell |
| Noor_WL | D6 | noor | wl.deletes | 2026-04-05 |  | 1 | write | wrote into empty cell |
| Noor_WL | E6 | noor | wl.purchases | 2026-04-05 |  | 1 | write | wrote into empty cell |
| Noor_WL | F6 | noor | wl.gifts | 2026-04-05 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A7 | noor | wl.date | 2026-04-06 |  | 2026-04-06 | write | appended new WL row (date not in template) |
| Noor_WL | B7 | noor | wl.game | 2026-04-06 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C7 | noor | wl.adds | 2026-04-06 |  | 5 | write | wrote into empty cell |
| Noor_WL | D7 | noor | wl.deletes | 2026-04-06 |  | 1 | write | wrote into empty cell |
| Noor_WL | E7 | noor | wl.purchases | 2026-04-06 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F7 | noor | wl.gifts | 2026-04-06 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A8 | noor | wl.date | 2026-04-07 |  | 2026-04-07 | write | appended new WL row (date not in template) |
| Noor_WL | B8 | noor | wl.game | 2026-04-07 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C8 | noor | wl.adds | 2026-04-07 |  | 11 | write | wrote into empty cell |
| Noor_WL | D8 | noor | wl.deletes | 2026-04-07 |  | 3 | write | wrote into empty cell |
| Noor_WL | E8 | noor | wl.purchases | 2026-04-07 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F8 | noor | wl.gifts | 2026-04-07 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A9 | noor | wl.date | 2026-04-08 |  | 2026-04-08 | write | appended new WL row (date not in template) |
| Noor_WL | B9 | noor | wl.game | 2026-04-08 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C9 | noor | wl.adds | 2026-04-08 |  | 4 | write | wrote into empty cell |
| Noor_WL | D9 | noor | wl.deletes | 2026-04-08 |  | 2 | write | wrote into empty cell |
| Noor_WL | E9 | noor | wl.purchases | 2026-04-08 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F9 | noor | wl.gifts | 2026-04-08 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A10 | noor | wl.date | 2026-04-09 |  | 2026-04-09 | write | appended new WL row (date not in template) |
| Noor_WL | B10 | noor | wl.game | 2026-04-09 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C10 | noor | wl.adds | 2026-04-09 |  | 9 | write | wrote into empty cell |
| Noor_WL | D10 | noor | wl.deletes | 2026-04-09 |  | 1 | write | wrote into empty cell |
| Noor_WL | E10 | noor | wl.purchases | 2026-04-09 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F10 | noor | wl.gifts | 2026-04-09 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A11 | noor | wl.date | 2026-04-10 |  | 2026-04-10 | write | appended new WL row (date not in template) |
| Noor_WL | B11 | noor | wl.game | 2026-04-10 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C11 | noor | wl.adds | 2026-04-10 |  | 11 | write | wrote into empty cell |
| Noor_WL | D11 | noor | wl.deletes | 2026-04-10 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E11 | noor | wl.purchases | 2026-04-10 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F11 | noor | wl.gifts | 2026-04-10 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A12 | noor | wl.date | 2026-04-11 |  | 2026-04-11 | write | appended new WL row (date not in template) |
| Noor_WL | B12 | noor | wl.game | 2026-04-11 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C12 | noor | wl.adds | 2026-04-11 |  | 14 | write | wrote into empty cell |
| Noor_WL | D12 | noor | wl.deletes | 2026-04-11 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E12 | noor | wl.purchases | 2026-04-11 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F12 | noor | wl.gifts | 2026-04-11 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A13 | noor | wl.date | 2026-04-12 |  | 2026-04-12 | write | appended new WL row (date not in template) |
| Noor_WL | B13 | noor | wl.game | 2026-04-12 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C13 | noor | wl.adds | 2026-04-12 |  | 9 | write | wrote into empty cell |
| Noor_WL | D13 | noor | wl.deletes | 2026-04-12 |  | 3 | write | wrote into empty cell |
| Noor_WL | E13 | noor | wl.purchases | 2026-04-12 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F13 | noor | wl.gifts | 2026-04-12 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A14 | noor | wl.date | 2026-04-13 |  | 2026-04-13 | write | appended new WL row (date not in template) |
| Noor_WL | B14 | noor | wl.game | 2026-04-13 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C14 | noor | wl.adds | 2026-04-13 |  | 2 | write | wrote into empty cell |
| Noor_WL | D14 | noor | wl.deletes | 2026-04-13 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E14 | noor | wl.purchases | 2026-04-13 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F14 | noor | wl.gifts | 2026-04-13 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A15 | noor | wl.date | 2026-04-14 |  | 2026-04-14 | write | appended new WL row (date not in template) |
| Noor_WL | B15 | noor | wl.game | 2026-04-14 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C15 | noor | wl.adds | 2026-04-14 |  | 7 | write | wrote into empty cell |
| Noor_WL | D15 | noor | wl.deletes | 2026-04-14 |  | 2 | write | wrote into empty cell |
| Noor_WL | E15 | noor | wl.purchases | 2026-04-14 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F15 | noor | wl.gifts | 2026-04-14 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A16 | noor | wl.date | 2026-04-15 |  | 2026-04-15 | write | appended new WL row (date not in template) |
| Noor_WL | B16 | noor | wl.game | 2026-04-15 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C16 | noor | wl.adds | 2026-04-15 |  | 9 | write | wrote into empty cell |
| Noor_WL | D16 | noor | wl.deletes | 2026-04-15 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E16 | noor | wl.purchases | 2026-04-15 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F16 | noor | wl.gifts | 2026-04-15 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A17 | noor | wl.date | 2026-04-16 |  | 2026-04-16 | write | appended new WL row (date not in template) |
| Noor_WL | B17 | noor | wl.game | 2026-04-16 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C17 | noor | wl.adds | 2026-04-16 |  | 5 | write | wrote into empty cell |
| Noor_WL | D17 | noor | wl.deletes | 2026-04-16 |  | 3 | write | wrote into empty cell |
| Noor_WL | E17 | noor | wl.purchases | 2026-04-16 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F17 | noor | wl.gifts | 2026-04-16 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A18 | noor | wl.date | 2026-04-17 |  | 2026-04-17 | write | appended new WL row (date not in template) |
| Noor_WL | B18 | noor | wl.game | 2026-04-17 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C18 | noor | wl.adds | 2026-04-17 |  | 11 | write | wrote into empty cell |
| Noor_WL | D18 | noor | wl.deletes | 2026-04-17 |  | 1 | write | wrote into empty cell |
| Noor_WL | E18 | noor | wl.purchases | 2026-04-17 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F18 | noor | wl.gifts | 2026-04-17 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A19 | noor | wl.date | 2026-04-18 |  | 2026-04-18 | write | appended new WL row (date not in template) |
| Noor_WL | B19 | noor | wl.game | 2026-04-18 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C19 | noor | wl.adds | 2026-04-18 |  | 15 | write | wrote into empty cell |
| Noor_WL | D19 | noor | wl.deletes | 2026-04-18 |  | 1 | write | wrote into empty cell |
| Noor_WL | E19 | noor | wl.purchases | 2026-04-18 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F19 | noor | wl.gifts | 2026-04-18 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A20 | noor | wl.date | 2026-04-19 |  | 2026-04-19 | write | appended new WL row (date not in template) |
| Noor_WL | B20 | noor | wl.game | 2026-04-19 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C20 | noor | wl.adds | 2026-04-19 |  | 13 | write | wrote into empty cell |
| Noor_WL | D20 | noor | wl.deletes | 2026-04-19 |  | 3 | write | wrote into empty cell |
| Noor_WL | E20 | noor | wl.purchases | 2026-04-19 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F20 | noor | wl.gifts | 2026-04-19 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A21 | noor | wl.date | 2026-04-20 |  | 2026-04-20 | write | appended new WL row (date not in template) |
| Noor_WL | B21 | noor | wl.game | 2026-04-20 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C21 | noor | wl.adds | 2026-04-20 |  | 11 | write | wrote into empty cell |
| Noor_WL | D21 | noor | wl.deletes | 2026-04-20 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E21 | noor | wl.purchases | 2026-04-20 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F21 | noor | wl.gifts | 2026-04-20 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A22 | noor | wl.date | 2026-04-21 |  | 2026-04-21 | write | appended new WL row (date not in template) |
| Noor_WL | B22 | noor | wl.game | 2026-04-21 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C22 | noor | wl.adds | 2026-04-21 |  | 4 | write | wrote into empty cell |
| Noor_WL | D22 | noor | wl.deletes | 2026-04-21 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E22 | noor | wl.purchases | 2026-04-21 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F22 | noor | wl.gifts | 2026-04-21 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A23 | noor | wl.date | 2026-04-22 |  | 2026-04-22 | write | appended new WL row (date not in template) |
| Noor_WL | B23 | noor | wl.game | 2026-04-22 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C23 | noor | wl.adds | 2026-04-22 |  | 13 | write | wrote into empty cell |
| Noor_WL | D23 | noor | wl.deletes | 2026-04-22 |  | 2 | write | wrote into empty cell |
| Noor_WL | E23 | noor | wl.purchases | 2026-04-22 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F23 | noor | wl.gifts | 2026-04-22 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A24 | noor | wl.date | 2026-04-23 |  | 2026-04-23 | write | appended new WL row (date not in template) |
| Noor_WL | B24 | noor | wl.game | 2026-04-23 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C24 | noor | wl.adds | 2026-04-23 |  | 7 | write | wrote into empty cell |
| Noor_WL | D24 | noor | wl.deletes | 2026-04-23 |  | 3 | write | wrote into empty cell |
| Noor_WL | E24 | noor | wl.purchases | 2026-04-23 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F24 | noor | wl.gifts | 2026-04-23 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A25 | noor | wl.date | 2026-04-24 |  | 2026-04-24 | write | appended new WL row (date not in template) |
| Noor_WL | B25 | noor | wl.game | 2026-04-24 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C25 | noor | wl.adds | 2026-04-24 |  | 6 | write | wrote into empty cell |
| Noor_WL | D25 | noor | wl.deletes | 2026-04-24 |  | 1 | write | wrote into empty cell |
| Noor_WL | E25 | noor | wl.purchases | 2026-04-24 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F25 | noor | wl.gifts | 2026-04-24 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A26 | noor | wl.date | 2026-04-25 |  | 2026-04-25 | write | appended new WL row (date not in template) |
| Noor_WL | B26 | noor | wl.game | 2026-04-25 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C26 | noor | wl.adds | 2026-04-25 |  | 3 | write | wrote into empty cell |
| Noor_WL | D26 | noor | wl.deletes | 2026-04-25 |  | 2 | write | wrote into empty cell |
| Noor_WL | E26 | noor | wl.purchases | 2026-04-25 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F26 | noor | wl.gifts | 2026-04-25 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A27 | noor | wl.date | 2026-04-26 |  | 2026-04-26 | write | appended new WL row (date not in template) |
| Noor_WL | B27 | noor | wl.game | 2026-04-26 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C27 | noor | wl.adds | 2026-04-26 |  | 1 | write | wrote into empty cell |
| Noor_WL | D27 | noor | wl.deletes | 2026-04-26 |  | 3 | write | wrote into empty cell |
| Noor_WL | E27 | noor | wl.purchases | 2026-04-26 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F27 | noor | wl.gifts | 2026-04-26 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A28 | noor | wl.date | 2026-04-27 |  | 2026-04-27 | write | appended new WL row (date not in template) |
| Noor_WL | B28 | noor | wl.game | 2026-04-27 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C28 | noor | wl.adds | 2026-04-27 |  | 6 | write | wrote into empty cell |
| Noor_WL | D28 | noor | wl.deletes | 2026-04-27 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E28 | noor | wl.purchases | 2026-04-27 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F28 | noor | wl.gifts | 2026-04-27 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A29 | noor | wl.date | 2026-04-28 |  | 2026-04-28 | write | appended new WL row (date not in template) |
| Noor_WL | B29 | noor | wl.game | 2026-04-28 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C29 | noor | wl.adds | 2026-04-28 |  | 14 | write | wrote into empty cell |
| Noor_WL | D29 | noor | wl.deletes | 2026-04-28 |  | 1 | write | wrote into empty cell |
| Noor_WL | E29 | noor | wl.purchases | 2026-04-28 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F29 | noor | wl.gifts | 2026-04-28 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A30 | noor | wl.date | 2026-04-29 |  | 2026-04-29 | write | appended new WL row (date not in template) |
| Noor_WL | B30 | noor | wl.game | 2026-04-29 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C30 | noor | wl.adds | 2026-04-29 |  | 9 | write | wrote into empty cell |
| Noor_WL | D30 | noor | wl.deletes | 2026-04-29 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | E30 | noor | wl.purchases | 2026-04-29 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F30 | noor | wl.gifts | 2026-04-29 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | A31 | noor | wl.date | 2026-04-30 |  | 2026-04-30 | write | appended new WL row (date not in template) |
| Noor_WL | B31 | noor | wl.game | 2026-04-30 |  | Noor | write | appended new WL row (date not in template) |
| Noor_WL | C31 | noor | wl.adds | 2026-04-30 |  | 9 | write | wrote into empty cell |
| Noor_WL | D31 | noor | wl.deletes | 2026-04-30 |  | 1 | write | wrote into empty cell |
| Noor_WL | E31 | noor | wl.purchases | 2026-04-30 |  | 0 | skip-zero | incoming number is 0 |
| Noor_WL | F31 | noor | wl.gifts | 2026-04-30 |  | 0 | skip-zero | incoming number is 0 |
| KPI by Quarter | B77 | noor | impressions | 2026-04-05 (Q2) |  | 4211 | write | wrote into empty cell |
| KPI by Quarter | B78 | noor | visits | 2026-04-05 (Q2) |  | 864 | write | wrote into empty cell |
| KPI by Quarter | C77 | noor | impressions | 2026-04-12 (Q2) |  | 6501 | write | wrote into empty cell |
| KPI by Quarter | C78 | noor | visits | 2026-04-12 (Q2) |  | 1173 | write | wrote into empty cell |
| KPI by Quarter | D77 | noor | impressions | 2026-04-19 (Q2) |  | 8297 | write | wrote into empty cell |
| KPI by Quarter | D78 | noor | visits | 2026-04-19 (Q2) |  | 1299 | write | wrote into empty cell |
| KPI by Quarter | E77 | noor | impressions | 2026-04-26 (Q2) |  | 4988 | write | wrote into empty cell |
| KPI by Quarter | E78 | noor | visits | 2026-04-26 (Q2) |  | 903 | write | wrote into empty cell |
| KPI by Quarter | F77 | noor | impressions | 2026-05-03 (Q2) |  | 2379 | write | wrote into empty cell |
| KPI by Quarter | F78 | noor | visits | 2026-05-03 (Q2) |  | 550 | write | wrote into empty cell |
