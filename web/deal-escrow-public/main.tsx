import React from 'react';
import {createRoot} from 'react-dom/client';
import './base.css';
import {Replay} from './Replay';
import {Study} from './Study';
const query=new URLSearchParams(location.search);
createRoot(document.getElementById('root')!).render(<React.StrictMode>{query.has('study')?<Study/>:<>{query.has('studyDemo')?<a className="study-return" href="/?study=1">← 참여자 질문지로 돌아가기</a>:null}<Replay/></>}</React.StrictMode>);
