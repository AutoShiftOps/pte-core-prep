// Grammar gym question bank. APPEND ONLY: ids are stored in the log.
// Each item: [id, rule, sentence with ___, correct answer, [wrong options], why]
// "—" as an option means "no word here".
// Rules match the English Grammar Master Sheet sections.
const B = [
  // 1. that / which / because + subject + verb
  ['m001', 'clause', 'The report highlights that ___ rose sharply last year.', 'costs', ['rising', 'increased'], 'After "that", a full clause: subject (costs) + verb (rose).'],
  ['m002', 'clause', 'The study found that ___ improved after the change.', 'productivity', ['improving', 'was improving of'], 'After "that" you need a subject before the verb "improved".'],
  ['m003', 'clause', 'The passage explains that ___ works best in small teams.', 'the method', ['method', 'works'], 'Subject first ("the method"), then the verb ("works").'],
  ['m004', 'clause', 'Many people believe that remote work ___ productivity.', 'improves', ['improving', 'to improve'], 'A that-clause needs a finite verb: remote work improves.'],
  ['m005', 'clause', 'Lab coats must ___ worn in the laboratory.', 'be', ['—', 'been'], 'Passive after a modal: must + be + past participle.'],
  ['m006', 'clause', 'Cities ___ need continuous coverage cannot use a four-day week easily.', 'that', ['—', 'what'], '"Cities need…" is a full sentence; to attach it to the main verb, use "that" (or "needing").'],
  ['m007', 'clause', 'The speaker argued that ___ is a problem of emotion, not laziness.', 'procrastination', ['procrastinate', 'procrastinated'], 'The subject of a clause is a noun: procrastination.'],
  ['m008', 'clause', 'Although the course was expensive, ___ worth it.', 'it was', ['was', 'being'], 'Each clause needs its own subject: although X, it was…'],
  ['m009', 'clause', 'Researchers suggest that the four-day week ___ best where output is measurable.', 'works', ['working', 'work'], 'Singular subject (the four-day week) + verb with -s: works.'],
  ['m010', 'clause', 'Because ___ was raining, the event moved indoors.', 'it', ['—', 'there'], 'English needs a subject even for weather: it was raining.'],

  // 2. to + base verb, or -ing
  ['m011', 'to', 'I am writing to ___ permission to attend the course.', 'request', ['requesting', 'requested'], 'Infinitive "to" + base verb: to request.'],
  ['m012', 'to', 'I look forward to ___ from you.', 'hearing', ['hear', 'heard'], '"Look forward to" is a to + -ing phrase (a noun fits: look forward to the meeting).'],
  ['m013', 'to', 'Many students take jobs to ___ pay for their studies.', 'help', ['helps', 'helping'], 'After "to", the base verb never takes -s: to help.'],
  ['m014', 'to', 'She is committed to ___ the team\'s performance.', 'improving', ['improve', 'improved'], '"Be committed to" takes -ing.'],
  ['m015', 'to', 'We decided ___ the meeting until Friday.', 'to postpone', ['postponing', 'postpone'], '"Decide" takes to + base verb.'],
  ['m016', 'to', 'He suggested ___ the deadline by a week.', 'extending', ['to extend', 'extend'], '"Suggest" takes -ing (or "suggest that we extend").'],
  ['m017', 'to', 'Please avoid ___ personal devices during the exam.', 'using', ['to use', 'use'], '"Avoid" takes -ing.'],
  ['m018', 'to', 'I plan to ___ my urgent tasks before the course.', 'finish', ['finishing', 'finished'], '"Plan" takes to + base verb.'],
  ['m019', 'to', 'Before ___ the course, I will hand over my work.', 'starting', ['start', 'to start'], 'After a preposition (before, after, by, without) use -ing.'],
  ['m020', 'to', 'Would you mind ___ me the report?', 'sending', ['to send', 'send'], '"Would you mind" takes -ing.'],
  ['m021', 'to', 'The manager let us ___ early on Friday.', 'leave', ['to leave', 'leaving'], '"Let someone" + base verb, no "to".'],
  ['m022', 'to', 'In addition to ___ costs, the plan saves time.', 'reducing', ['reduce', 'reduced'], '"In addition to" takes -ing.'],

  // 3. one -s rule (subject-verb agreement)
  ['m023', 'agree', 'Clear instructions ___ reduce mistakes in the workplace.', 'help', ['helps', 'helping'], 'Plural noun (instructions) → verb without -s.'],
  ['m024', 'agree', 'The teams ___ freedom to redesign their work.', 'have', ['has', 'having'], 'Teams (plural) → have.'],
  ['m025', 'agree', 'The airline ___ cancelled several flights.', 'has', ['have', 'having'], 'One airline → has.'],
  ['m026', 'agree', 'The quality of the results ___ high.', 'is', ['are', 'be'], 'The subject is "quality" (singular), not "results".'],
  ['m027', 'agree', 'One of the students ___ late every day.', 'is', ['are', 'were being'], '"One of the + plural" takes a singular verb.'],
  ['m028', 'agree', 'Each employee ___ a laptop.', 'receives', ['receive', 'receiving'], '"Each" takes a singular verb.'],
  ['m029', 'agree', 'A number of people ___ waiting outside.', 'are', ['is', 'was'], '"A number of" + plural → plural verb.'],
  ['m030', 'agree', 'The number of applicants ___ increased this year.', 'has', ['have', 'are'], '"The number of" → singular verb.'],
  ['m031', 'agree', 'There ___ several reasons for the delay.', 'are', ['is', 'was'], '"There are" + plural noun.'],
  ['m032', 'agree', 'My manager ___ the report on her desk by Thursday.', 'wants', ['want', 'wanting'], 'One manager → wants.'],
  ['m033', 'agree', 'Rising costs ___ forced some restaurants to raise their prices.', 'have', ['has', 'having'], 'Costs (plural) → have.'],

  // 4. articles
  ['m034', 'article', 'The company reported ___ significant increase in profits.', 'a', ['the', '—'], 'Singular countable, first mention → a.'],
  ['m035', 'article', 'Students must submit their work before ___ end of the week.', 'the', ['a', '—'], '"The end of…" is specific.'],
  ['m036', 'article', 'I would like to attend ___ Forward Deployed Engineer course.', 'the', ['—', 'an'], 'A singular countable noun never stands alone; one specific course → the.'],
  ['m037', 'article', 'Could you give me ___ advice about the exam?', 'some', ['an', 'a'], '"Advice" is uncountable: some advice, never an advice.'],
  ['m038', 'article', 'The meeting lasted ___ hour.', 'an', ['a', 'the'], '"An" before a vowel SOUND: an hour.'],
  ['m039', 'article', 'She studied at ___ university in Toronto.', 'a', ['an', '—'], '"University" starts with a "you" sound → a.'],
  ['m040', 'article', 'This is ___ best course I have taken.', 'the', ['a', '—'], 'Superlatives take "the".'],
  ['m041', 'article', '___ moon moves around the Earth.', 'The', ['A', '—'], 'Only one exists → the.'],
  ['m042', 'article', 'Most of the research was funded by ___ government grant.', 'a', ['an', '—'], 'One grant, not specified before → a.'],
  ['m043', 'article', '___ cats are popular pets in Canada.', '—', ['The', 'A'], 'Plural used generally → no article.'],

  // 5. countable / uncountable
  ['m044', 'count', 'The proposal lacked supporting ___.', 'evidence', ['evidences', 'an evidence'], '"Evidence" is uncountable: no -s, no "an".'],
  ['m045', 'count', 'Could you give me some ___ about the course?', 'information', ['informations', 'an information'], '"Information" is uncountable.'],
  ['m046', 'count', 'We need ___ time to finish the project.', 'more', ['many', 'a few'], '"Time" (uncountable) → much / more / less.'],
  ['m047', 'count', 'There were ___ errors in the second draft.', 'fewer', ['less', 'much'], 'Countable plural → fewer.'],
  ['m048', 'count', 'He gave me some useful ___.', 'advice', ['advices', 'an advice'], '"Advice" is uncountable.'],
  ['m049', 'count', 'Inflation has made ___ goods more expensive.', 'everyday', ['every', 'each'], '"Every" needs a singular noun; "everyday" is the adjective meaning "ordinary".'],
  ['m050', 'count', 'The lab bought new ___ last month.', 'equipment', ['equipments', 'an equipment'], '"Equipment" is uncountable.'],
  ['m051', 'count', 'A large ___ of money was spent on the project.', 'amount', ['number', 'many'], 'Uncountable (money) → an amount of.'],
  ['m052', 'count', 'The lecture contained a lot of useful ___.', 'vocabulary', ['vocabularies', 'vocabularys'], '"Vocabulary" is normally uncountable.'],

  // 6. prepositions and verb pairs
  ['m053', 'prep', 'The four-day week does not ___ every sector.', 'suit', ['suit for', 'fit for'], '"Suit" takes no preposition.'],
  ['m054', 'prep', 'I will attend ___ the workshop next week.', '—', ['to', 'at'], '"Attend" (go to) takes no preposition.'],
  ['m055', 'prep', 'Success depends ___ careful planning.', 'on', ['of', 'from'], 'depend on.'],
  ['m056', 'prep', 'We discussed ___ the budget at length.', '—', ['about', 'on'], '"Discuss" takes no preposition.'],
  ['m057', 'prep', 'The policy had a large impact ___ small businesses.', 'on', ['to', 'for'], 'impact on / effect on.'],
  ['m058', 'prep', 'The course will contribute ___ our team\'s success.', 'to', ['for', 'in'], 'contribute to.'],
  ['m059', 'prep', 'I would appreciate your help ___ this request.', 'with', ['on', 'in'], 'help with (a task or request).'],
  ['m060', 'prep', 'The meeting is ___ Monday at 9 a.m.', 'on', ['in', 'at'], 'Days take "on".'],
  ['m061', 'prep', 'The exam is ___ November.', 'in', ['on', 'at'], 'Months take "in".'],
  ['m062', 'prep', 'Please send the report ___ Thursday.', 'by', ['until', 'in'], '"By" = no later than.'],
  ['m063', 'prep', 'The flights were cancelled ___ bad weather.', 'because of', ['because', 'despite'], '"Because of" + noun; "because" + clause.'],
  ['m064', 'prep', 'The lecture explained the reason ___ the decline.', 'for', ['of', 'to'], 'reason for.'],
  ['m065', 'prep', 'Companies have trialled ___ a four-day week.', '—', ['with', 'on'], '"Trial" (verb) takes no preposition.'],

  // 7. tense
  ['m066', 'tense', 'Social media ___ the way businesses market products.', 'has transformed', ['is transform', 'transforming'], 'Past change with a present result, no time given → present perfect.'],
  ['m067', 'tense', 'The proposal was rejected because it ___ supporting evidence.', 'lacked', ['lack', 'lacking'], 'Keep the past tense of the sentence: was rejected… lacked.'],
  ['m068', 'tense', 'Students should cite the sources they ___ in their research.', 'used', ['using', 'uses'], 'The research is finished → past: used.'],
  ['m069', 'tense', 'The passage ___ that remote work offers flexibility.', 'explains', ['explained that it', 'is explain'], 'Describe texts and charts in the present simple.'],
  ['m070', 'tense', 'I ___ in Canada since 2021.', 'have lived', ['live', 'am living since'], '"Since" + a point in time → present perfect.'],
  ['m071', 'tense', 'Companies ___ the four-day week in 2022.', 'trialled', ['have trialled', 'trial'], 'A finished time (in 2022) → past simple.'],
  ['m072', 'tense', 'The meeting ___ when I arrived.', 'had started', ['has started', 'starts'], 'Earlier past before another past event → past perfect.'],
  ['m073', 'tense', 'I ___ my urgent tasks before the course starts.', 'will finish', ['finished', 'am finish'], 'A promise about the future → will.'],
  ['m074', 'tense', 'Rising costs ___ forced restaurants to raise prices.', 'have', ['are', 'had been'], 'Recent change with a present result → have forced.'],

  // 8. passive
  ['m075', 'passive', 'The lecture has ___ moved to the main hall.', 'been', ['be', 'being'], 'Present perfect passive: has been + past participle.'],
  ['m076', 'passive', 'Mobile phones ___ switched off during the exam.', 'are', ['will', 'have'], 'Present passive rule: are + past participle.'],
  ['m077', 'passive', 'The library will be ___ for maintenance.', 'closed', ['close', 'closing'], 'Passive: be + past participle (closed).'],
  ['m078', 'passive', 'The research was ___ by a government grant.', 'funded', ['fund', 'funding'], 'was + past participle.'],
  ['m079', 'passive', 'The system is ___ updated right now.', 'being', ['been', 'be'], 'Passive continuous: is being + past participle.'],
  ['m080', 'passive', 'Wetlands were once ___ useless land.', 'considered', ['consider', 'considering'], 'were + past participle.'],

  // 9. word families
  ['m081', 'form', 'Reading regularly improves ___ and memory.', 'concentration', ['concentrate', 'concentrated'], 'After a verb (improves) the object is a noun.'],
  ['m082', 'form', 'The results improved ___ after the change.', 'significantly', ['significant', 'significance'], 'Describing a verb (improved) → adverb (-ly).'],
  ['m083', 'form', 'She made a quick ___ about the budget.', 'decision', ['decide', 'decisive'], 'After "a quick" (adjective) → noun.'],
  ['m084', 'form', 'The training was very ___ for new staff.', 'beneficial', ['benefit', 'beneficially'], 'After "very" describing a noun → adjective.'],
  ['m085', 'form', 'We need to ___ the instructions before Monday.', 'clarify', ['clarity', 'clear'], 'After "to" → verb.'],
  ['m086', 'form', 'Which sense do you use to listen to music? ___', 'hearing', ['hear', 'heard'], '"Which sense" asks for a noun: hearing.'],
  ['m087', 'form', 'The project was a great ___.', 'success', ['successful', 'succeed'], 'After "a great" → noun.'],
  ['m088', 'form', 'Careful ___ of the data is essential.', 'analysis', ['analyse', 'analytical'], 'Subject of the sentence → noun.'],
  ['m089', 'form', 'Teams that work ___ deliver better results.', 'productively', ['productive', 'productivity'], 'Describing the verb "work" → adverb.'],
  ['m090', 'form', 'Regular ___ keeps the equipment safe.', 'maintenance', ['maintain', 'maintaining of'], 'After an adjective (regular) → noun.'],

  // 10. plural agreement
  ['m091', 'plural', 'Rising costs forced some restaurants to raise their ___.', 'prices', ['price', 'pricing'], 'Many restaurants, many prices: plural matches plural.'],
  ['m092', 'plural', 'Many ___ take part-time jobs.', 'students', ['student', 'student\'s'], '"Many" + plural noun.'],
  ['m093', 'plural', 'Students must submit their ___ before Friday.', 'assignments', ['assignment', 'assignment\'s'], 'Several students → several assignments.'],
  ['m094', 'plural', 'The city connects the centre with its ___.', 'suburbs', ['suburb', 'suburban'], 'A city has many suburbs.'],
  ['m095', 'plural', 'One of the main ___ is cost.', 'reasons', ['reason', 'reason\'s'], '"One of the" + plural noun.'],
  ['m096', 'plural', 'Several ___ have reported higher productivity.', 'companies', ['company', 'companys'], '"Several" + plural; -y → -ies.'],
  ['m097', 'plural', 'The company\'s ___ rose last year.', 'profits', ['profit\'s', 'profitable'], 'Plural noun (no apostrophe for plurals).'],
  ['m098', 'plural', 'Both ___ agreed on the new plan.', 'managers', ['manager', 'manager\'s'], '"Both" + plural noun.'],
];

export default B.map(([id, rule, q, a, d, why]) => ({ id, rule, q, a, d, why }));
