import {firebaseConfig} from './firebase-config.js?v=2';
import {buildFeedback,feedbackDocumentId,feedbackKey} from './feedback-model.js?v=2';
let connection;
function saved(f){try{return localStorage.getItem(feedbackKey(f))!==null;}catch{return false;}}
export {saved as hasSubmittedFeedback};
async function connect(){
 const [appSdk,authSdk,storeSdk]=await Promise.all([
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
  import('https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js')]);
 const app=appSdk.initializeApp(firebaseConfig,'sunset-feedback');
 try{
  const auth=authSdk.getAuth(app);
  await auth.authStateReady();
  if(!auth.currentUser)await authSdk.signInAnonymously(auth);
  return {uid:auth.currentUser.uid,db:storeSdk.getFirestore(app),sdk:storeSdk};
 }catch(error){
  // A failed Auth initialization is cached by the SDK; recreate it for a retry.
  await appSdk.deleteApp(app).catch(()=>{});
  throw error;
 }
}
async function persistFeedback(forecast,agrees){
 if(saved(forecast))return {duplicate:true};
 if(!connection)connection=connect().catch(error=>{connection=null;throw error;});
 const {uid,db,sdk}=await connection;
 const payload=buildFeedback(forecast,agrees,uid);
 const ref=sdk.doc(db,'sunsetFeedback',feedbackDocumentId(forecast,uid));
 const existing=await sdk.getDoc(ref);
 if(!existing.exists())await sdk.setDoc(ref,{...payload,sunsetAt:sdk.Timestamp.fromMillis(payload.sunsetAt),retrievedAt:sdk.Timestamp.fromMillis(payload.retrievedAt),createdAt:sdk.serverTimestamp()});
 try{localStorage.setItem(feedbackKey(forecast),'submitted');}catch{}
 return {duplicate:existing.exists()};
}

export async function submitFeedback(forecast,agrees){
 let timer;
 try{return await Promise.race([persistFeedback(forecast,agrees),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Feedback confirmation timed out')),20000);})]);}
 finally{clearTimeout(timer);}
}
