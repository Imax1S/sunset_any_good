import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,deleteDoc,collection,getDocs,serverTimestamp,Timestamp} from 'firebase/firestore';
const env=await initializeTestEnvironment({projectId:'demo-sunset-feedback',firestore:{host:'127.0.0.1',port:8185,rules:await readFile('../../firestore.rules','utf8')}});
const user=env.authenticatedContext('reader1',{firebase:{sign_in_provider:'anonymous'}}).firestore(),other=env.authenticatedContext('reader2').firestore(),anon=env.unauthenticatedContext().firestore();
const id='reader1_2026-10-06_-8.65_115.13',now=Date.now();
const payload={uid:'reader1',modelVersion:'heuristic-v1',agrees:true,forecastDate:'2026-10-06',score:76,verdict:'go',sunsetAt:Timestamp.fromMillis(now-3600000),retrievedAt:Timestamp.fromMillis(now-7200000),createdAt:serverTimestamp(),predictionTiming:'before-sunset',location:{latitude:-8.65,longitude:115.13,latitudeText:'-8.65',longitudeText:'115.13'},weather:{high:97,mid:0,low:9,corridorClear:82,haze:18,visibilityKm:22.7},hazeSource:'aod'};
try{
 await assertSucceeds(getDoc(doc(user,'sunsetFeedback',id)));
 await assertFails(setDoc(doc(anon,'sunsetFeedback',id),payload));
 await assertFails(setDoc(doc(other,'sunsetFeedback',id),payload));
 for(const change of [{extra:'unexpected'},{score:101},{score:76,verdict:'skip'},{agrees:'yes'},{createdAt:Timestamp.fromMillis(now-10000)},{sunsetAt:Timestamp.fromMillis(now+61*60000)},{sunsetAt:Timestamp.fromMillis(now-13*3600000)},{weather:{...payload.weather,high:101}},{predictionTiming:'after-sunset'},{uid:'reader2'},{modelVersion:'fake'}])await assertFails(setDoc(doc(user,'sunsetFeedback',id),{...payload,...change}));
 for(const [date,offset] of [['2026-10-07',60*60000],['2026-10-08',30*60000]]){
  const early={...payload,forecastDate:date,sunsetAt:Timestamp.fromMillis(Date.now()+offset),retrievedAt:Timestamp.fromMillis(now),predictionTiming:'before-sunset'};
  await assertSucceeds(setDoc(doc(user,'sunsetFeedback',`reader1_${date}_-8.65_115.13`),early));
 }
 await assertSucceeds(setDoc(doc(user,'sunsetFeedback',id),payload));
 await assertSucceeds(getDoc(doc(user,'sunsetFeedback',id)));
 await assertFails(getDoc(doc(other,'sunsetFeedback',id)));
 await assertFails(getDoc(doc(anon,'sunsetFeedback',id)));
 await assertFails(getDocs(collection(user,'sunsetFeedback')));
 await assertFails(setDoc(doc(user,'sunsetFeedback',id),{...payload,agrees:false}));
 await assertFails(deleteDoc(doc(user,'sunsetFeedback',id)));
 await assertFails(setDoc(doc(user,'unrelated',id),payload));
 await assertSucceeds(setDoc(doc(user,'sunsetFeedbackChecks',id),{...payload,agrees:false,retrievedAt:Timestamp.fromMillis(now),predictionTiming:'after-sunset'}));
 console.log('PASS: create/own get, anonymous isolation, schema/ranges/timestamps/verdict, duplicate denial, no list/update/delete and isolated test collection');
}finally{await env.cleanup();}
