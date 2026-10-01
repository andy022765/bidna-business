# -*- coding: utf-8 -*-
"""Лист правды — двенадцать полей. Анкета вместо сорокаминутного звонка."""
import json,io,sys
def Q(i,r,t,h="",o=None): return {"id":i,"req":r,"text":t,"hint":h,"options":o or [],"pok":i}

BLOKI=[
{"num":"1","title":"What you sell, and for how much","sub":"The prices an assistant is allowed to say out loud. Ranges are fine; \"we quote on site\" is an answer too.","qs":[
 Q("1.1",True,"Your business name as a caller would hear it, and what you do in one line."),
 Q("1.2",True,"Every service you sell, with the price or the range for each. If a price is only given after a visit, say that instead of a number.",
   "This is the single most important field. Every wrong price a robot invents comes from this list being thin."),
 Q("1.3",True,"Your fees, in plain numbers: call-out fee, diagnostic fee, deposit, minimum charge, after-hours surcharge. Write \"none\" where there isn't one."),
 Q("1.4",True,"Anything free — and be exact about what it covers. \"Free estimate\" means what, and for which jobs?",
   "\"Free\" is the word robots give away most easily. If it has conditions, write the conditions.")]},
{"num":"2","title":"What you do not do","sub":"The list that stops a robot booking work you can't deliver.","qs":[
 Q("2.1",True,"Services people ask for that you decline. Name them the way callers ask, not the way the trade does.",
   "A robot booked a 2021 Tesla for an oil change because nobody ever wrote down that it doesn't."),
 Q("2.2",True,"Where you go and where you don't: cities, counties, ZIP codes, or a radius from an address. Say what happens when someone is outside it."),
 Q("2.3",False,"Brands, models, makes or property types you don't handle."),
 Q("2.4",False,"Anyone you don't take as a customer, and what to say to them.")]},
{"num":"3","title":"When you answer","sub":"","qs":[
 Q("3.1",True,"Your hours, day by day, including weekends."),
 Q("3.2",True,"What should happen to a call at 9 p.m. on a Saturday. Take a message, book it, or say you're closed?",
   "Pick one. \"Whatever makes sense\" is what produces the answers you'd never approve."),
 Q("3.3",True,"What counts as an emergency for you, and what you do about it out of hours."),
 Q("3.4",False,"Days you're closed this year: holidays, shutdowns, vacation.")]},
{"num":"4","title":"What callers actually ask","sub":"Your answers, in your words. This is what the assistant repeats instead of inventing.","qs":[
 Q("4.1",True,"The three questions you get most, and your exact answer to each."),
 Q("4.2",True,"A question you get often that you'd rather a person answered, not a machine. What should it say instead?"),
 Q("4.3",False,"Something callers regularly get wrong about you, and the correction.")]},
{"num":"5","title":"Promotions and what may not be said","sub":"Both halves matter. The second half is what we test you against.","qs":[
 Q("5.1",True,"Every offer, discount or promotion running right now, with its exact conditions and end date. If there are none, write \"none\" — that is the answer we test against.",
   "A caller told one robot \"someone said the first visit is free.\" It agreed. There was no such offer."),
 Q("5.2",True,"Words, claims or promises that must never be said on your line — by law, by industry rule, or because they aren't you.",
   "Guarantees, medical or legal claims, price promises, \"licensed and insured\" if the wording matters, competitor comparisons."),
 Q("5.3",True,"Who decides a price, a discount or a refund. What should the assistant do when a caller pushes for one?",
   "Our default: it never grants one and hands the call to a person. Say so if you want it different.")]},
{"num":"6","title":"What happens after the call","sub":"","qs":[
 Q("6.1",True,"What a caller should be told to expect: who calls back, how soon, and from what number."),
 Q("6.2",True,"Who a call gets transferred to, and when. Names, numbers, and what each one handles."),
 Q("6.3",True,"What you must know about a job before it can be booked at all.",
   "Address, make and model, size, photos, whether they own the place. Anything missing here becomes a wasted visit."),
 Q("6.4",False,"Anything you'd like added to the recording announcement at the start of the call.")]},
]
D={"title":"Your line's truth sheet",
   "subtitle":"Twenty-two questions, filled once. Everything we test your phone line against comes from here.",
   "intro":("<p>This is the document your phone line gets measured against. Every call we make is compared to "
    "what you write here, line by line — so a finding is never our opinion, it is your own words next to what "
    "your line actually said.</p>"
    "<p><strong>Two things before you start.</strong></p>"
    "<ul><li>We do <strong>not</strong> need access to your CRM, your accounts or your customer list. "
    "Everything below is what you tell us, in your words.</li>"
    "<li>Where a number is uncomfortable to put in writing, write the range or \"on the call\".</li></ul>"
    "<p><strong>The fields that matter most are the ones people skip:</strong> what you do <em>not</em> do, "
    "and what may <em>not</em> be said. A line gives away money on the promises nobody wrote down. "
    "Of eighteen lines we called in September, four confirmed a discount that did not exist.</p>"
    "<p><strong>Answer however suits you:</strong> press the microphone in any field and talk, or type. "
    "Answers save as you go, so stop whenever you like and come back.</p>"
    "<p><strong>At your own pace.</strong> Twenty-two questions, sixteen of them required.</p>"
    "<p><strong>Where to send it:</strong> <a href=\"mailto:support@businessinteldna.com\">support@businessinteldna.com</a>.</p>"),
   "blocks":BLOKI,
   "attachments":["<strong>Your current price list</strong> — any form: a PDF, a page on your site, a photo of the board",
     "<strong>The script your front desk uses</strong>, if there is one",
     "<strong>Recordings of real calls</strong>, if your phone system keeps them — this is your callers' actual language",
     "<strong>Your current assistant's prompt or settings</strong>, if a vendor set one up and you can export it",
     "<strong>Anything a caller is told in writing</strong>: confirmation emails, texts, booking pages"],
   "closing":("<ol><li>You send this back.</li>"
     "<li>We read it and come back once with anything that is unclear — one round, not a stream of questions.</li>"
     "<li>You approve the final sheet. Until you sign it, we do not start calling.</li>"
     "<li>Thirty calls across a grid of hours, then the protocol: every answer your line gave, next to what this "
     "sheet says it should have been.</li></ol>"
     "<p>The sheet stays yours. It works on any assistant, ours or a vendor's, and you can hand it to whoever "
     "runs your phone next.</p>")}
n=sum(len(b["qs"]) for b in BLOKI); r=sum(1 for b in BLOKI for q in b["qs"] if q["req"])
io.open(sys.argv[1],"w",encoding="utf-8").write(json.dumps(D,ensure_ascii=False))
print("вопросов %d · обязательных %d · блоков %d · %.0f КБ"%(n,r,len(BLOKI),len(json.dumps(D,ensure_ascii=False).encode())/1024))
