import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

export default function TermsAndConditions() {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar />

      {/* Hero Header */}
      <header className="bg-white border-b border-slate-200/90 pt-28 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-4 tracking-wider uppercase">
            <button onClick={() => navigate('/')} className="hover:text-blue-600 transition-colors">Home</button>
            <span>/</span>
            <span className="text-slate-900">Legal</span>
            <span>/</span>
            <span className="text-blue-600 font-bold">Terms & Condition</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#0f172a] tracking-tight">
                Our Terms
              </h1>
              <p className="mt-2 text-base sm:text-lg text-slate-600 font-medium">
                Comprehensive financial solutions for businesses and individuals
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-2 sm:self-start">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Terms & Condition
              </span>
            </div>
          </div>

          {/* Policy Navigation Tabs */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm">
            <button 
              onClick={() => { navigate('/privacy-policy'); window.scrollTo(0, 0); }}
              className="px-4 py-2 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200/80 transition-all"
            >
              Privacy Policy
            </button>
            <button 
              onClick={() => { navigate('/terms-and-conditions'); window.scrollTo(0, 0); }}
              className="px-4 py-2 rounded-lg font-bold bg-[#0f172a] text-white shadow-sm transition-all"
            >
              Terms & Condition
            </button>
            <button 
              onClick={() => { navigate('/refund-policy'); window.scrollTo(0, 0); }}
              className="px-4 py-2 rounded-lg font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200/80 transition-all"
            >
              Refund Policy
            </button>
            <span className="ml-auto text-xs text-slate-600 font-medium hidden md:inline-block">
              Effective Date: 2026
            </span>
          </div>
        </div>
      </header>

      {/* Main Legal Document Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 lg:p-12 space-y-9 text-[#0f172a]">

          {/* Agreement Intro */}
          <section className="space-y-4 text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
            <p>
              The User Online Registration Form, User E-Sign Consent, User Terms and Conditions, together with the Privacy Policy and Chargeback Policy (collectively referred to as the “Agreement”), constitute the complete terms and conditions governing the access to and use of the services provided by Rupiksha (“Services”)This Agreement is a legally binding contract between the User (as defined herein) and Rupiksha (“we”,“us”, or “our”) and governs the legal relationship between the User and Rupiksha in connection with the Services. For this Agreement, the terms “User(s)” ,“you”, and “your” shall collectively refer to the Seller(s) and/or Buyer(s), as applicable.
            </p>

            <div className="bg-amber-50/70 border-l-4 border-amber-500 p-4 sm:p-5 rounded-r-xl space-y-3">
              <h3 className="text-sm font-extrabold text-amber-950 uppercase tracking-wider flex items-center gap-2">
                <span>⚠️</span> IMPORTANT
              </h3>
              <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-normal">
                This is an important legal document and should be carefully reviewed before deciding whether to access or use the Rupiksha Services at any time. Please read the terms and conditions of this Agreement (including all documents and links incorporated herein by reference) carefully before accepting it. This Agreement also outlines certain risks associated with the use of the Rupiksha Services and guides the facilitation of online payments through Rupiksha. You are solely responsible for understanding and complying with all applicable laws, rules, and regulations of your respective jurisdiction that may apply to your business operations and your use of the Rupiksha Services. <strong>BY CLICKING THE ACCEPTANCE BUTTON OR BY ACCESSING, USING, OR INSTALLING ANY PART OF THE SERVICES, THE USER EXPRESSLY AGREES TO AND CONSENTS TO BEING LEGALLY AND IRREVOCABLY BOUND BY THIS AGREEMENT AND ALL TERMS CONTAINED HEREIN.</strong>
              </p>
              <p className="text-xs sm:text-sm text-amber-950 leading-relaxed font-normal">
                If the User does not agree to all the terms of this Agreement, the option indicating non-acceptance must be selected. In such an event, Rupiksha shall immediately cancel the association, and the User shall not be permitted to access, use, or install any part of the Services. This Agreement shall be deemed accepted by Rupiksha and shall be considered duly executed, valid, and legally binding only upon receipt of the User’s information, completion of due verification by Rupiksha, and issuance of confirmation or verification of the contractual relationship by Rupiksha to the User, as more specifically provided herein. The contract shall be deemed to have been received, accepted, and formed at Rupiksha’s registered office in the State of Bihar, India, and shall begoverned accordingly.
              </p>
            </div>
          </section>

          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">1.</span>
              SERVICES BEING OFFERED BY RUPIKSHA
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-3 font-normal">
              <p>
                <strong>Subject to these Terms of Use:</strong> Merchant Onboarding Policy, KYC Policy, Disputes and Grievance Redressal Policy, and Privacy Policy (collectively, the “Policies”), Rupiksha offers the Services as more particularly described in Schedule I hereto. Rupiksha is continuously developing and enhancing its offerings to provide the best possible experience and information to its Users. You acknowledge and agree that the form, scope, and nature of the Services provided by Rupiksha may change from time to time, at its sole discretion, without prior notice. As part of this ongoing process, you further acknowledge and agree that Rupiksha may suspend, modify, discontinue, or terminate (either permanently or temporarily) the Services or any part or feature thereof, either in respect of you or Users generally, at Rupiksha’s sole discretion and without prior notice. You may discontinue use of the Services at any time and are not required to provide specific notice to Rupiksha upon such discontinuation. You acknowledge and agree that, if Rupiksha disables or restricts access to your User account, you may be prevented from accessing the Services, your account information, or any files, records, or other content associated with your account. Rupiksha shall notify you of such action in accordance with applicable law.
              </p>
              <p>
                Rupiksha reserves the right, subject to applicable law, to delete or anonymize User information stored in your account, including but not limited to personal information and sensitive personal data or information (“SPDI”). Alternatively, a User may notify Rupiksha of their request not to retain or use such personal information or SPDI by contacting the designated Grievance Officer (details provided below). You acknowledge that, in such circumstances, Rupiksha may be unable to provide some or all of theServices. You further acknowledge and agree that, while Rupiksha may not presently impose a fixed upper limit on the number of transmissions, transactions, or communications that may be sent or received through the Services, Rupiksha reserves the right to prescribe such limits at any time, at its sole discretion. By accessing or using the Services, you acknowledge and agree that Rupiksha disclaims any liability for the accuracy, completeness, or continued validity of information that may have become outdated since the date of its last update. Rupiksha reserves the right to modify, update, or correct any content on its website at any time without prior notice. Unless expressly stated otherwise, all images, graphics, and informational content displayed on the website are believed to be in the public domain, including promotional materials, publicity photographs, stock media, or similarsources. If you are the copyright owner of any content displayed on the website and believe that such use infringes applicable copyright laws, you may notify the Grievance Officer by email, clearly identifying the relevant webpage URL to enable prompt review. Rupiksha shall endeavour to address such concerns and take appropriate action where required.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">2.</span>
              SCOPE OF THE AGREEMENT
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-3 font-normal">
              <p>
                Rupiksha agrees to permit the User to register and provide the requisite details on Rupiksha’s website and/or mobile application. The User shall create a password and is solely responsible for maintaining the confidentiality of such password and account credentials. The User shall be fully responsible for all activities carried out through their account, whether authorised or unauthorised. The User agrees to immediately notify Rupiksha of any unauthorised use of their account or password or any other breach of security. Rupiksha shall not be liable for any loss or damage arising from unauthorised use of the User’s account, whether or not such use was within the User’s knowledge.
              </p>
              <p>
                Rupiksha may, from time to time, prescribe additional terms, guidelines, operating rules, or policies governing specific Services, features, products, or promotional offerings. The User shall be solely responsible for ensuring compliance with the applicable terms, guidelines, and policies of Rupiksha and/or any third-party service provider with whom the User chooses to transact, including any service-specific terms, rules, or conditions. The User agrees that they shall not copy, reproduce, distribute, exchange, modify, sell, transmit, publish, or exploit any content available on Rupiksha’s website and/or application, including but not limited to text, images, audio, or video, for any commercial, business, or public purpose, without the prior written consent of Rupiksha. Rupiksha reserves the right, at its sole discretion, to suspend, restrict, or terminate access to all or any part of its website, application, sales channels, or related Services, at any time and without prior notice, including but not limited to for maintenance, security, operational, or regulatory reasons.
              </p>
              <p>
                Subject to the User’s continued compliance with this Agreement, Rupiksha grants the User a limited, non-exclusive, non-transferable, and revocable right to access and use its website and/or application solely for lawful purposes. The User agrees not to disrupt, interfere with, or attempt to interfere with the operation, security, or integrity of the website and/or application in any manner. Access to certain sections of Rupiksha’s website and/or application may be restricted to registered Users. To register, the User may be required to provide certain information, some of which may be mandatory. The User represents and warrants that all information provided during registration and thereafter is true, accurate, complete, and up to date.
              </p>
              <p>
                The products and Services displayed on the website and/or application may not be available in all geographic locations. Any reference to such products or Services does not constitute a representation or warranty that the same shall be available in any specific location. The User is responsible for verifying the availability of products or Services in their respective jurisdiction through Rupiksha or its authorised representatives. In addition to this Agreement, certain Services or products offered by Rupiksha may be governed by service-specific terms and conditions, which shall be communicated or updated by Rupiksha from time to time. Such service-specific terms shall be deemed to form an integral part of this Agreement. In the event of any inconsistency between such service-specific terms and this Agreement, the provisions of this Agreement shall prevail, unless expressly stated otherwise. Rupiksha’s Services are offered to the User subject to unconditional acceptance of all terms, conditions, and notices contained in this Agreement and any applicable service-specific terms. For the avoidance of doubt, the User’s access to or use of the Services shall constitute an acknowledgment of, and agreement to be bound by, this Agreement. If the User does not agree to any part of this Agreement, the User must refrainfrom accessing or using the Services.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">3.</span>
              TERMS OF WEBSITE USER(S) ELIGIBILITY
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              For this Agreement, “User(s)” shall mean any individual or entity who accesses, uses, or is authorised to use the services provided by Rupiksha through its website and/or application. The Services are available only to persons who are competent to enter into legally binding contracts under applicable laws. Accordingly, User(s) must not be minors or otherwise legally incapacitated under Indian law. Without limitation, User(s) must have attained at least eighteen (18) years of age to be eligible to access or use Rupiksha’s online Services. Rupiksha advises all Users (s) to comply with all applicable laws, rules, and regulations while accessing or using the website and/or application. Rupiksha shall not be responsible or liable for any consequences arising out of the User’s acts, omissions, conduct, orbehaviour during the use of the website and/or application. Rupiksha reserves the right, at its sole discretion and without obligation to assign any reason, to refuse, restrict, suspend, or terminate access to the Services for any User at any time.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">4.</span>
              THE USER’S RESPONSIBILITY OF COGNIZANCE OF THIS AGREEMENT
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-3 font-normal">
              <p>
                If the User downloads or copies any content from Rupiksha’s website and/or application, the User shall not remove, alter, or obscure any copyright notices, trademark notices, or other proprietary notices accompanying such content. Rupiksha endeavours to ensure that the information, descriptions, and content displayed on each page of the website and/or application are accurate and up to date. However, Rupiksha does not warrant the completeness or accuracy of such information and shall not be responsible for any changes arising due to human error, data entry inaccuracies, or third-party updates, nor for any loss or damage suffered by the User as a result of reliance on such information. Rupiksha does not own or operate the services provided by third-party service providers and, therefore, cannot control or prevent changes to their published descriptions. Rupiksha reserves the right to modify or update website or application content at any time.
              </p>
              <p>
                The User shall obtain trading limits and/or wallet balance only through their authorised Distributor and shall not deposit or transfer funds directly into any Rupiksha bank account for wallet loading. In the event the User deposits or transfers funds directly to Rupiksha, the corresponding wallet balance shall be credited to the User’s Distributor, and the User shall be required to obtain the wallet balance from such Distributor. Rupiksha shall bear no liability for any loss incurred by the User arising from such direct fund transfers. The User shall not take any action based on information available on the website and/or application until a transaction confirmation has been duly received. If the User does not receive confirmation of a transaction via email or SMS (including after checking spam or junk folders), the User shall promptly contact Rupiksha’s customer support or grievance redressal department.
              </p>
              <p>
                Rupiksha shall take reasonable measures to safeguard the website and/or application from viruses and other malicious software. However, Rupiksha does not guarantee that the website and/or application shall be free from viruses or other harmful components at all times. The User shall implement appropriate security measures prior to downloading any material. Rupiksha shall not be liable for any damage to computer systems, devices, or other property resulting from access to or use of the website and/or application. The website and/or application may contain links to third-party websites or applications. Such third-party platforms are not under the control of Rupiksha, and Rupiksha shall not be responsible for the content, accuracy, updates, or practices of any linked site. The inclusion of any such link is provided solely for convenience and does not constitute an endorsement or affiliation by Rupiksha with the operators or owners of such third-party platforms. Rupiksha acts solely as a business facilitator or agent and does not assume any responsibility or liability for the quality, standard, or performance of services rendered by suppliers or third-party service providers. Under no circumstances shall Rupiksha be liable for services provided directly by any third party.
              </p>
              <p className="font-semibold text-slate-900">The User expressly agrees NOT to:</p>
              <ul className="list-disc pl-5 space-y-1.5 text-slate-800">
                <li>Defame, abuse, harass, stalk, threaten, or otherwise violate the legal rights of any person, including rights of privacy, publicity, or reputation.</li>
                <li>Publish, post, upload, distribute, transmit, or disseminate any content or material that is defamatory, infringing, obscene, indecent, misleading, unlawful, or otherwise objectionable under applicable law.</li>
                <li>Upload, attach, or transmit any files, software, or materials protected by intellectual property rights, privacy rights, or publicity rights unless the User owns or lawfully controls such rights or has obtained all necessary consents and authorisations as required by law.</li>
                <li>Upload, attach, transmit, or distribute any files or content containing viruses, malware, corrupted files, or any other software or programs designed to interrupt, destroy, or limit the functionality of any computer system, network, or data.</li>
                <li>Remove, alter, delete, or obscure any author attributions, copyright notices, legal notices, or proprietary designations or labels contained in any file, content, or material uploaded or accessed through the Services.</li>
                <li>Falsify, misrepresent, or obscure the origin or source of any software, file, content, or other material uploaded, transmitted, or made available through the website, application, or any associated facility.</li>
                <li>Advertise, promote, or offer to sell any goods or services, conduct or forward surveys, contests, chain letters, or similar solicitations, or download or distribute any content posted by another user where the User knows or reasonably ought to know that such content cannot be lawfully distributed in such manner.</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">5.</span>
              OWNERSHIP
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              It is agreed between the parties that all materials available on Rupiksha’s website and/or application, including but not limited to text, images, graphics, audio, video, software, icons, logos, designs, and other content (collectively, the “Content”), are owned by Rupiksha and/or its licensors. The User shall not use the Content except as expressly permitted under this Agreement. The User agrees to comply with all instructions and restrictions displayed on the website and/or application governing the use of the Content. The website and/or application, including all underlying technology and Content, constitutes the sole and exclusive property of Rupiksha and/or its licensors. Rupiksha and its licensors retain all right, title, and interest in and to the website and/or application, including all intellectual property rights such as copyrights, trademarks, service marks, patents, trade secrets, and other proprietary rights. Any unauthorised access, use, reproduction, modification, distribution, or exploitation of the website and/or application or its Content may violate applicable intellectual property and other laws. The website and/or application may display proprietary logos, service marks, trademarks, or trade names owned by Rupiksha or third parties. The display of such marks does not grant the User any licence, right, or permission to use such logos, service marks, trademarks, or trade names in any manner. Any unauthorised use of the Content or proprietary marks may violate applicable laws relating to intellectual property, privacy, and publicity.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">6.</span>
              FEES AND PAYMENT
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              Rupiksha reserves the right to levy transaction fees or service charges in respect of certain transactions completed through the use of its Services. Rupiksha further reserves the right, at its sole discretion, to revise, modify, introduce, or withdraw any fees, renewal charges, usage charges, or other applicable charges from time to time, with or without prior notice, subject to applicable law. The User shall be solely responsible for the payment of all fees, charges, duties, taxes, levies, and other statutory or governmental assessments arising out of or in connection with the use of the Services. If a transaction is not initiated, processed, or confirmed for any reason whatsoever, Rupiksha shall not be under any obligation to reinitiate such transaction, nor to compensate, substitute, or replace the unconfirmed transaction. Any subsequent transaction initiated by the User shall be treated as a new and independent transaction, without reference to any prior unconfirmed or incomplete transaction.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">7.</span>
              ELIGIBLE CUSTOMERS
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              To access and use the Services, you must be an individual who is at least eighteen (18) years of age and legally competent to enter into binding contracts under applicable law, or a corporation, partnership, trust, association of persons, or other legal entity duly capable of entering into legally binding contracts under applicable law. In the case of any such entity, the individual accessing or using the Services represents and warrants that they are duly authorised to accept these Terms of Use and to access, use, and avail of the Services on behalf of such entity. If you do not meet these eligibility requirements, you must not access or use the Services. If you are not a Resident Indian, you may access and use the Services only to the extent permitted under the laws of India and the laws of your country of residence. You acknowledge and agree that access to or use of the Services may be restricted or prohibited under applicable local laws, and that any such access or use is undertaken at your sole risk. You further agree that you shall be solely and fully responsible for any liabilities, penalties, or consequences arising from any violation of applicable laws andshall indemnify and hold harmless Rupiksha from and against any claims, losses, damages, or liabilities arising in connectiontherewith.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">8.</span>
              CONTENT
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              For these Terms of Use, the term “Content” shall include, without limitation, all information, data, text, logos, trademarks, photographs, images, videos, audio clips, animations, written posts, articles, comments, software, scripts, graphics, themes, designs, and interactive features that are generated, provided, published, transmitted, or otherwise made available on or through the Services. You acknowledge that Content made available to you as part of the Services, including but not limited to advertisements, sponsored content, and third-party materials, may be protected by intellectual property rights owned by Rupiksha, its licensors, advertisers, sponsors, or other third parties. Except as expressly permitted under this Agreement or with prior written authorisation from Rupiksha or the respective rights holder, you shall not modify, reproduce, distribute, transmit, publish, license, sell, lease, rent, create derivative works from, or otherwise exploit such Content, in whole or in part. Rupiksha reserves the right, but shall not be obligated, to pre-screen, monitor, review, flag, filter, edit, refuse, restrict, or remove any Content made available through the Services, at its sole discretion and without prior notice. Rupiksha further reserves the right to moderate, publish, re-publish, display, distribute, and otherwise use any User-generated content, including but not limited to reviews, feedback, profile images, comments, By submitting, uploading, or posting any Content on the website or application, you grant Rupiksha a non-exclusive, worldwide, perpetual, irrevocable, royalty-free, transferable, and sub-licensable licence to use, host, store, reproduce, modify, adapt, publish, translate, distribute, publicly display, and otherwise exploit such Content for the purposes of operating, promoting, and improving the Services. You acknowledge and agree that, by using the Services, you may be exposed to Content that may be inaccurate, offensive, indecent, or otherwise objectionable, and that your access to and use of the Services is at your sole risk. You further agree that you are solely responsible for all Content that you create, upload, transmit, or display while using the Services, and for the consequences thereof. Rupiksha shall not be responsible or liable to you or any third party for such Content or for any loss, damage, or liability arising from your actions or omissions in connection with the Services.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">9.</span>
              COMPLIANCE WITH ANTI-BRIBERY AND ANTI-CORRUPTION LAWS
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              The User agrees, represents, and unconditionally undertakes to comply with all applicable anti-bribery, anti-corruption, and financial crime laws, regulations, and standards, whether of India or any other applicable jurisdiction, including but not limited to the Foreign Corrupt Practices Act, 1977, the UK Bribery Act, 2010, the Prevention of Corruption Act, 1988, the Prevention of Money Laundering Act, 2002, the Foreign Contribution (Regulation) Act, 2010, and all rules, regulations, notifications, and amendments thereto. The User further undertakes that neither the User nor any of its directors, officers, employees, representatives, agents, intermediaries, or any other person acting on its behalf shall, directly or indirectly, give, offer, promise, authorise, solicit, receive, or accept any payment, gift, hospitality, benefit, or thing of value for the purpose of influencing, inducing, or rewarding any improper action or securing any undue commercial, regulatory, or business advantage. For this Agreement, “Government Officials” shall include, without limitation, any employee or representative of a government or governmental authority, any candidate for public office, any employee of a government-owned or government-controlled entity, any official or employee of a public international organisation, any judicial or regulatory authority, and any political party, political office-bearer, or electoral candidate. The User further agrees and undertakes not to make, offer, authorise, or facilitate any improper payment or benefit, whether directly or indirectly, to any person or entity, including private individuals or third parties, for the purpose of inducing or influencing any favourable decision or action in relation to the Services or otherwise. The User also represents and warrants that it complieswith, and shall continue to comply with, all applicable Know Your Customer (KYC), Anti-Money Laundering (AML), and CombatingFinancing of Terrorism (CFT) guidelines, directions, and circulars issued by the Reserve Bank of India (RBI), including those issuedby the Department of Regulation, as amended from time to time, and shall take all actions necessary to maintain such complianceduring the term of this Agreement.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">10.</span>
              RIGHT OF CANCELLATION BY THE COMPANY IN CASE OF INVALID INFORMATION PROVIDED BY THE USER
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              The User expressly represents, warrants, and undertakes to provide only true, accurate, complete, and valid information while requesting or availing any Services under this Agreement and agrees not to make any misrepresentation, concealment, or omission of material facts. Any breach of this obligation by the User shall render this Agreement voidable at the sole discretion of Rupiksha and shall disentitle the User from availing the Services. If at any time, whether during or after receipt of a request for Services, Rupiksha discovers or has reasonable grounds to believe that any request for Services is unauthorised, fraudulent, or based on information that is false, inaccurate, incomplete, misleading, or otherwise not in compliance with this Agreement or applicable law, Rupiksha shall have the unrestricted right, at its sole discretion and without prior notice, to take such action as it deems appropriate. Such actions may include, without limitation, suspension or termination of the User account, cancellation or reversal of transactions, denial of Services, or reporting to regulatory or law enforcement authorities. In such circumstances, Rupiksha shall not be responsible or liable for any loss, damage, cost, or expense suffered or incurred by the User as a result of such suspension, cancellation, or denial of Services. The User hereby irrevocably agrees to indemnify, defend, and hold harmless Rupiksha, its directors, officers, employees, and agents, from and against all claims, losses, damages, liabilities, costs, or expenses arising out of or in connection with any action taken by Rupiksha in good faith to protect its interests, comply with legal or regulatory obligations, or safeguard its customers, including actions taken in respect of suspected fraudulent or unauthorised transactions.
            </p>

            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-4 sm:p-5 mt-2 space-y-2">
              <h3 className="text-sm font-bold text-[#0f172a] uppercase tracking-wide">DISCLAIMER OF WARRANTY</h3>
              <p className="text-xs sm:text-sm text-slate-800 leading-relaxed text-justify font-normal">
                a) b) c) Rupiksha and its service providers make no representations or warranties of any kind, express or implied, in respect of the website and/or application, the Content, products, or Services, all of which are provided on an “as is” and “as available” basis. Rupiksha and its service providers expressly disclaim any warranty or representation that the website and/or application shall be error-free, uninterrupted, timely, secure, or free from viruses, malware, or other harmful components, or that communications transmitted to or from the website and/or application shall be secure or not intercepted. Rupiksha does not warrant or represent that the Services or any functionality made available through the website and/or application will operate without interruption or that any defects will be corrected. Rupiksha further disclaims any warranty as to the accuracy, completeness, reliability, or timeliness of any Content made available on or through the website and/orapplication. The inclusion, display, or offering of any product or Service on the website and/or application shall not be construed as an endorsement, recommendation, or guarantee of such product or Service by Rupiksha. To the fullest extent permitted under applicable law, Rupiksha and its service providers expressly disclaim all warranties and conditions, whether express, implied, statutory, or otherwise, including but not limited to implied warranties or conditions of merchantability, fitness for a particular purpose, title, non-infringement, and any warranties arising out of statute, course of dealing, usage of trade, or otherwise.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">11.</span>
              LIMITATION OF LIABILITY
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-3 font-normal">
              <p>
                Subject to applicable law, the User agrees that access to and use of the website and/or application, including all Content, Products, and Services, is entirely at the User’s own risk. All Services and Products made available through the website and/or application are subject to the terms, conditions, rules, tariffs, limitations, and regulatory requirements imposed by the respective service providers, including but not limited to conditions of carriage, international conventions, arrangements, and applicable government or regulatory laws. Service providers offering products or Services through the Company’s platform are independent contractors and shall not be deemed to be agents, partners, joint ventures, or employees of the Company. The Company does not control and shall not be responsible for the acts, omissions, representations, warranties, or services of such providers.
              </p>
              <p>
                To the maximum extent permitted under applicable law, in no event shall the Company or its service providers be liable to any User or third party for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, loss of data, loss of business, or any other loss or damage, whether arising under contract, tort, negligence, strict liability, or otherwise, arising out of or in connection with:
              </p>
              <ul className="list-roman pl-6 space-y-1 text-slate-800 font-normal">
                <li>(i) the use of, access to, browsing of, or downloading from any part of the website and/or application or its Content;</li>
                <li>(ii) any failure, delay, interruption, suspension, or inability to use any part of the website and/or application for transactions or otherwise;</li>
                <li>(iii) the performance or non-performance of the Company or any service provider;</li>
                <li>(iv) any error, omission, interruption, deletion, defect, delay in operation or transmission, computer virus, malware, communication failure, theft, destruction, unauthorized access to, alteration of, or use of records or data.</li>
              </ul>
              <p>
                The User expressly acknowledges and agrees that the Company is not the seller, supplier, or provider of the products or Services offered through the platform. The Company merely facilitates the purchase or access to products or Services provided by third- party service providers by offering a technology platform. Accordingly, any defect, deficiency, delay, failure, or dispute in relation to such products or Services shall be resolved solely between the User and the respective service provider. The Company may, at its discretion, direct the User to the concerned service provider, but shall not be responsible or liable for the same.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">12.</span>
              CONFIDENTIALITY
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-3 font-normal">
              <p>
                Each Party acknowledges, agrees, and undertakes that all information, whether oral, written, electronic, or in any other form, obtained from or disclosed by the other Party in connection with this Agreement and/or during the performance of obligations hereunder—including but not limited to data, documents, records, applications, business or customer information, marketing strategies, plans, processes, programs, financial details, trade secrets, know-how, and other proprietary or confidential information (collectively, “Confidential Information”)—shall remain the sole and exclusive property of the disclosing Party and shall be treated as strictly confidential.
              </p>
              <p>
                The receiving Party shall, during the term of this Agreement and thereafter, use the Confidential Information solely for the purpose of fulfilling its obligations under this Agreement and for no other purpose whatsoever. The receiving Party shall not, directly or indirectly, disclose, disseminate, publish, or otherwise make available any Confidential Information to any third party except to such persons as may be expressly authorized in writing by the disclosing Party and only on a strict need-to-know basis.
              </p>
              <p>
                Upon expiry or termination of this Agreement, or upon written demand by the disclosing Party at any time during the term of this Agreement, the receiving Party shall promptly return or destroy (as instructed by the disclosing Party) all Confidential Information, including all copies, extracts, or reproductions thereof, in its possession or control.
              </p>
              <p>
                The obligations of confidentiality under this Agreement shall survive for the term of this Agreement and for a period of five (5) years following its termination or expiry. However, the confidentiality obligations shall not apply to any information that:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-800 font-normal">
                <li>(a) is or becomes publicly available other than through a breach of this Agreement by the receiving Party;</li>
                <li>(b) was lawfully known to the receiving Party before disclosure, as evidenced by written records;</li>
                <li>(c) is independently developed by the receiving Party without reference to or use of the Confidential Information; or</li>
                <li>(d) is required to be disclosed pursuant to applicable law, regulation, court order, or governmental authority, provided that the receiving Party gives prior written notice to the disclosing Party (where legally permissible) to enable the disclosing Party to seek appropriate protective measures.</li>
              </ul>
              <p>
                Nothing contained herein shall restrict either Party from disclosing Confidential Information to the extent required in connection with legal, regulatory, or judicial proceedings arising out of or relating to this Agreement.
              </p>
            </div>
          </section>

          {/* Section 13 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">13.</span>
              RIGHT TO REFUSE
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-3 font-normal">
              <p>
                Without prejudice to any other rights or remedies available to Rupiksha under this Agreement, the Terms of Service, or applicable law, Rupiksha reserves the absolute and sole right, at any time and without prior notice, to restrict, suspend, or terminate aUser’s access to the Website and/or Application, limit or cancel transactions, deactivate User accounts, issue warnings to other users, or refuse to provide any Services, in whole or in part, in any of the following circumstances:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-800 font-normal">
                <li>(a) where the User is in breach of this Agreement, the Terms of Service, or any policies, guidelines, or documents incorporated herein by reference;</li>
                <li>(b) where Rupiksha is unable to verify, authenticate, or validate any information, documentation, or declarations provided by the User, including KYC or compliance-related information; or</li>
                <li>(c) where Rupiksha reasonably believes that the User’s conduct may infringe upon the rights of any third party, violate any applicable law, regulation, guideline, or regulatory directive (including RBI guidelines), or expose Rupiksha, other users, or any third party to legal, financial, operational, or reputational risk.</li>
              </ul>
              <p>
                Rupiksha may, at its sole discretion and subject to such conditions as it may deem appropriate, reinstate a suspended User. A User whose account has been permanently or indefinitely suspended shall not create, attempt to create, or access any other account, nor use the Website and/or Application in any manner whatsoever, unless such suspension is expressly revoked by Rupiksha in writing. Notwithstanding anything contained herein, in the event of a breach of this Agreement, the Terms of Service, or any documents incorporated by reference, Rupiksha reserves the right to recover all amounts due and payable by the User to Rupiksha and/or any service provider, and to initiate appropriate civil, criminal, or regulatory proceedings, including reporting to competent authorities, as may be deemed necessary under applicable law.
              </p>
            </div>
          </section>

          {/* Section 14 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">14.</span>
              REPRESENTATIONS AND WARRANTIES OF THE USER
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-2 font-normal">
              <p>The User hereby represents, warrants, declares, and undertakes to Rupiksha that:</p>
              <ol className="list-decimal pl-5 space-y-2 text-slate-900">
                <li><strong>Legal Capacity and Eligibility:</strong> The User, if a natural person, is at least eighteen (18) years of age, of sound mind, legally competent, and duly entitled to enter into this Agreement and related policies. The User is a resident of India holding valid credentials and is legally eligible to carry on business activities in India under applicable laws. Where the User is an entity, it is duly incorporated, validly existing, and authorised to conduct business in India.</li>
                <li><strong>Accuracy of KYC Information:</strong> All information, data, and documents submitted by the User for Know Your Customer (KYC) verification with Rupiksha, including identity and address proofs, are true, correct, complete, genuine, and authentic, and have not been fabricated, altered, manipulated, or misrepresented in any manner whatsoever.</li>
                <li><strong>Indemnity for KYC Discrepancies:</strong> The User agrees to fully indemnify, defend, and hold harmless Rupiksha, its promoters, directors, officers, employees, agents, affiliates, subsidiaries, and representatives from and against any loss, liability, claim, penalty, damage, cost, or expense arising out of or in connection with any discrepancy, misrepresentation, falsification, or inaccuracy—whether intentional or unintentional—found in the KYC documents or information submitted by the User.</li>
                <li><strong>User’s Sole Responsibility for KYC Compliance:</strong> Any liability, whether incidental or otherwise, arising in connection with the User’s or merchant’s KYC formalities for availing Rupiksha’s Services shall be the sole and absolute responsibility of the User. Rupiksha shall not be liable in any manner whatsoever, including for verification, validation, or assessment of the authenticity of the KYC documents submitted by the User.</li>
                <li><strong>Compliance with Applicable Laws:</strong> The User shall be solely responsible for understanding, complying with, and adhering to all applicable central, state, and local laws, rules, regulations, guidelines, notifications, and regulatory directives relevant to the User’s business. Any liability—financial, civil, criminal, or regulatory—arising out of non-compliance shall be borne solely by the User.</li>
                <li><strong>Declared Nature of Business:</strong> The User shall operate its business strictly in accordance with the business declaration made to Rupiksha at the time of onboarding. The User shall immediately notify Rupiksha in writing of any change, modification, expansion, reduction, or deviation in the nature or scope of its business activities.</li>
                <li><strong>Intellectual Property Rights:</strong> All data, information, inventions, intellectual property rights (including patents, trademarks, copyrights, designs, trade secrets), processes, methodologies, analytical tools, procedures, software, technical know-how, documentation,updates, and modifications used or provided by Rupiksha for the purpose of availing its Services shall remain the sole and exclusive intellectual property of Rupiksha. Nothing contained herein shall be construed as granting the User any right, title, or interest in such intellectual property.</li>
                <li><strong>Prohibition on Storage of Card Data:</strong> The User shall not store, retain, process, or transmit any customer card details or related sensitive payment data in any form or manner whatsoever on its systems, servers, websites, applications, or databases.</li>
                <li><strong>Merchant Category Code (MCC) Declaration:</strong> The User shall be solely responsible for declaring the correct line of business under the applicable Merchant Category Code (MCC). Rupiksha reserves the right to withhold settlements, suspend transactions, or terminate Services in the event of any incorrect declaration, mismatch, misuse, or violation relating to the MCC.</li>
                <li><strong>Audit and Regulatory Cooperation:</strong> The User shall provide full, timely, and unconditional cooperation to Rupiksha, its authorised representatives, auditors, regulators, or appointed agencies for conducting audits, inspections, or reviews, including for compliance with this Agreement, Rupiksha’s policies, and applicable laws.</li>
              </ol>
            </div>
          </section>

          {/* Section 15 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">15.</span>
              SECURITY RULES
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-2 font-normal">
              <p>The User shall not violate or attempt to violate the security, integrity, or proper functioning of the Rupiksha website, application, servers, systems, or networks. Without limitation, the User is expressly prohibited from engaging in any of the following activities:</p>
              <ol className="list-decimal pl-5 space-y-1.5 text-slate-800 font-normal">
                <li><strong>Unauthorised Access:</strong> Accessing, attempting to access, or using data, systems, servers, accounts, or networks that are not intended for the User, or logging into any server or account for which the User does not have valid authorisation.</li>
                <li><strong>Security Testing and Breach Attempts:</strong> Probing, scanning, testing, or attempting to test the vulnerability of any Rupiksha system or network, or attempting to breach security, authentication, or access-control measures, without the express prior written consent of Rupiksha.</li>
                <li><strong>Interference with Services:</strong> Interfering or attempting to interfere with the proper functioning of the Services or disrupting access for any User, host, or network, including but not limited to the introduction or transmission of viruses, malware, Trojan horses, worms, logic bombs, or any other malicious code, or by engaging in activities such as overloading, flooding, mail bombing, denial-of-service attacks, or system crashing.</li>
                <li><strong>Unsolicited Communications:</strong> Sending or facilitating the sending of unsolicited electronic communications, including but not limited to spam, bulk messages, promotions, advertisements, or solicitations of products or services, through or using the Rupiksha platform.</li>
              </ol>
            </div>
          </section>

          {/* Section 16 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">16.</span>
              EXCLUSION OF WARRANTIES
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-2.5 font-normal">
              <p>
                Nothing contained in these Terms of Use, including this clause, shall exclude or limit any warranty or liability of the User to the extent such exclusion or limitation is prohibited under applicable law. Certain jurisdictions do not permit the exclusion of specific warranties or conditions, or the limitation or exclusion of liability for losses or damages arising from negligence, breach of contract, breach of implied terms, or incidental or consequential damages. Accordingly, only such exclusions and limitations as are legally permissible in the applicable jurisdiction shall apply, and the liability of Rupiksha shall, in all cases, be limited to the maximum extent permitted under applicable law. To the fullest extent permitted by law, Rupiksha expressly disclaims all implied warranties in relation to the Services and the use thereof.
              </p>
              <p>The User expressly acknowledges and agrees that the use of the Services is at the User’s sole risk and that the Services are provided on an “as is” and “as available” basis.</p>
              <p>Without limitation, Rupiksha, its affiliates, associates, licensors, and service providers do not represent or warrant that:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-800 font-normal">
                <li>1. The information or content made available on the Website and/or Application is accurate, complete, current, or error- free;</li>
                <li>2. The Services will meet the User’s requirements or expectations;</li>
                <li>3. The Services will be uninterrupted, timely, secure, or free from defects or errors;</li>
                <li>4. any information obtained by the User through the use of the Services will be accurate, reliable, or fit for any particular purpose; or</li>
                <li>5. Any defects or errors in the operation or functionality of any software, platform, or system provided as part of the Services will be corrected.</li>
              </ul>
              <p>
                Any material downloaded, accessed, or otherwise obtained through the use of the Services is done at the User’s own discretion and risk. The User shall be solely responsible for any damage to the User’s computer systems, devices, software, or loss of data resulting from such access, download, or use.
              </p>
            </div>
          </section>

          {/* Section 17 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">17.</span>
              REPRESENTATIONS AND WARRANTIES OF THE USER
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-2 font-normal">
              <p>The User hereby represents, warrants, and undertakes to Rupiksha that:</p>
              <ol className="list-decimal pl-5 space-y-2 text-slate-900">
                <li><strong>Eligibility and Capacity:</strong> Where the User is a natural person, the User is at least eighteen (18) years of age, of sound mind, competent, and legally capable of entering into binding contracts under applicable law. The User is a resident of India with valid credentials and is legally eligible and authorised to carry on business activities in India.</li>
                <li><strong>Accuracy of KYC Information:</strong> All information, documents, and records relating to the User’s identity, address, and other particulars submitted to Rupiksha for Know Your Customer (KYC) verification are true, correct, complete, valid, and genuine, and have not been fabricated, forged, altered, or misrepresented in any manner whatsoever.</li>
                <li><strong>Indemnity for KYC Discrepancies:</strong> The User agrees to indemnify, defend, and hold harmless Rupiksha, its promoters, directors, officers, employees, agents, affiliates, subsidiaries, and representatives from and against any liabilities, losses, damages, penalties, claims, or expenses arising out of or in connection with any incidental, intentional, or subsequent discrepancy, misrepresentation, or inaccuracy in the KYC documents or information submitted by the User.</li>
                <li><strong>Responsibility for KYC-Related Liabilities:</strong> Any liability, whether incidental or upfront, arising in connection with the User’s or merchant’s KYC compliance for availing Rupiksha’s Services shall be the sole responsibility of the User. Rupiksha and its affiliates or office bearers shall not be liable for verifying, guaranteeing, or ascertaining the authenticity or validity of the KYC documents submitted by the User.</li>
                <li><strong>Compliance with Applicable Laws:</strong> The User shall be solely responsible for understanding and complying with all applicable laws, rules, regulations, guidelines, and regulatory requirements relevant to the User and the User’s business. Any liability, whether financial or otherwise, arising from non-compliance shall be borne exclusively by the User at the User’s own cost and risk.</li>
                <li><strong>Declared Business Activity:</strong> The User shall operate and conduct business strictly in accordance with the business declaration provided to Rupiksha at the time of onboarding. The User shall promptly notify Rupiksha in writing of any change, deviation, addition, or deletion in the nature or scope of business activities.</li>
                <li><strong>Intellectual Property Rights:</strong> All data, information, inventions, intellectual property rights (including patents, trademarks, copyrights, designs, and trade secrets), know-how, processes, software, analytical methods, procedures, manuals, financial information,technical expertise, and any updates or modifications thereto, provided or made available by Rupiksha for the purpose of availing its Services, shall remain the sole and exclusive intellectual property of Rupiksha. Nothing herein shall be construed as granting the User any right, title, or interest in such intellectual property.</li>
                <li><strong>Prohibition on Storage of Card Data:</strong> The User shall not store, retain, process, or transmit any customer card details or related sensitive data, in any form or manner whatsoever, including on the User’s websites, servers, systems, or databases.</li>
                <li><strong>Merchant Category Code (MCC) Declaration:</strong> It shall be the exclusive responsibility of the User to ensure that the correct line of business is declared under the appropriate Merchant Category Code (MCC). Rupiksha reserves the right to withhold settlements, suspend transactions, or take other appropriate action in the event of any mismatch, misdeclaration, or violation relating to the MCC.</li>
                <li><strong>Audit and Regulatory Cooperation:</strong> The User shall provide full, timely, and adequate cooperation to Rupiksha, its appointed agencies, auditors, or regulatory authorities to conduct audits, inspections, or reviews, including for compliance with these Policies and applicable laws.</li>
              </ol>
            </div>
          </section>

          {/* Section 18 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">18.</span>
              RELATIONSHIP
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              Nothing contained in this Agreement, the Terms of Use, any related policies, notices, or the User’s access to or use of the Rupiksha website and/or application, or any partner website and/or application, shall be construed as creating any partnership, joint venture, agency, employment, fiduciary, or other similar relationship between the User and Rupiksha. Neither party shall have any authority to act for, represent, or bind the other in any manner whatsoever. The User shall not represent, directly or indirectly, that the User has any authority to bind Rupiksha or to incur any obligation or liability on behalf of Rupiksha. Each party shall at all times remain an independent contractor, and nothing in this Agreement shall be deemed to create any relationship other than that of independent contracting parties.
            </p>
          </section>

          {/* Section 19 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">19.</span>
              SEVERABILITY
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              If any provision of this Agreement is held to be invalid, illegal, or unenforceable, in whole or in part, by any court or competent authority, such invalidity or unenforceability shall apply only to the specific provision or portion thereof so declared. The remaining portion of such provision and all other provisions of this Agreement shall continue in full force and effect, to the maximum extent permitted under applicable law.
            </p>
          </section>

          {/* Section 20 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">20.</span>
              UPDATION OF INFORMATION BY THE COMPANY
            </h2>
            <p className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify font-normal">
              The User acknowledges that Rupiksha provides its Services with reasonable skill, care, and diligence and endeavours to ensure that Users do not experience inconvenience in the use of its Services. However, the User understands and agrees that, from time to time, the information, software, products, services, advertisements, and other materials made available on or through the Rupiksha website, application, or other distribution or sales channels may contain inaccuracies, omissions, or typographical errors. Rupiksha reserves the right to correct any such errors, inaccuracies, or omissions as and when they are identified, without prior notice. The information provided may be changed, updated, supplemented, or removed periodically. Rupiksha further reserves the right, at any time and without prior notice, to make modifications, improvements, or changes to the website, application, content, features, functionality, or Services.
            </p>
          </section>

          {/* Section 21 */}
          <section className="space-y-3">
            <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] pb-2 border-b border-slate-100 flex items-center gap-2">
              <span className="text-blue-600 font-extrabold">21.</span>
              MISCELLANEOUS
            </h2>
            <div className="text-[15px] sm:text-base leading-relaxed text-slate-800 text-justify space-y-2.5 font-normal">
              <ol className="list-decimal pl-5 space-y-2 text-slate-900">
                <li><strong>Entire Agreement:</strong> This Agreement constitutes the entire understanding between the Parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, negotiations, representations, or understandings, whether written or oral, relating to the same subject matter.</li>
                <li><strong>Amendment:</strong> No amendment, modification, or variation of this Agreement shall be valid or binding unless made in writing and duly executed by authorised representatives of both Parties.</li>
                <li><strong>Effect of Termination:</strong> Termination or expiry of this Agreement for any reason whatsoever shall not relieve either Party from any rights, obligations, or liabilities that have accrued before such termination, or which may accrue in respect of any act or omission occurring before termination.</li>
                <li><strong>Headings:</strong> The headings used in this Agreement are inserted for convenience only and shall not affect the interpretation or construction of any provision of this Agreement.</li>
                <li><strong>Further Assurances:</strong> Each Party shall, at its own cost, execute, deliver, and perform such further acts, deeds, instruments, and documents as may be reasonably required from time to time to give full effect to the intent, purpose, and terms of this Agreement.</li>
                <li><strong>Cumulative Remedies:</strong> The rights and remedies provided under this Agreement are cumulative and not exclusive of any rights or remedies available under applicable law, in equity, or otherwise. The exercise of any one or more remedies shall not preclude the exercise of any other remedy available to a Party, except as expressly provided herein.</li>
                <li><strong>Survival:</strong> The provisions of this Agreement which by their nature are intended to survive termination or expiry, including but not limited to provisions relating to confidentiality, intellectual property, limitation of liability, indemnity, governing law and jurisdiction, representations and warranties, and any accrued payment obligations, shall survive the termination or expiry of this Agreement.</li>
              </ol>
            </div>
          </section>

        </div>
      </main>

      <Footer />
    </div>
  );
}
