import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import BlogEditor from '../../../src/features/blog/components/BlogEditor';
import { createEmptyBlogFormData, generateBlogSlug } from '../../../src/features/blog/shared/blogUtils';
import '../../../src/index.css';
function Preview() { const [data,setData]=useState(createEmptyBlogFormData); const [attempted,setAttempted]=useState(false); return <div className="painel-theme kifer-ds min-h-screen bg-[var(--bg-canvas)] px-4 py-5 sm:px-8 lg:px-12"><BlogEditor editingPost={null} formData={data} onFormDataChange={setData} onTitleChange={title=>setData(current=>({...current,title,slug:generateBlogSlug(title),meta_title:title}))} onContentChange={content=>setData(current=>({...current,content}))} onContentImageUpload={()=>{}} onCoverImageUpload={()=>{}} onClose={()=>{}} onSave={()=>setAttempted(true)} validationAttempted={attempted} saving={false} uploadingCover={true} uploadingContent={false} /></div> }
createRoot(document.getElementById('root')!).render(<Preview />);
