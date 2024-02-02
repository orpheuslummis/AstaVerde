export default function Page() {
  return (
    <div className="pt-4 flex flex-col gap-4">
      <h1 className="text-xl font-bold">EcoTradeZone of Bionerg Ltd. Privacy Policy</h1>
      <p className="text-sm">Date: 31 Jan 2024</p>
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Our contact details</h2>
        <p>Name: Bionerg Ltd.</p>
        <p>Address: 4th Floor, 5B The Parklands, Lostock, Bolton, BL6 4SD</p>
        <p>Company number: 9139423</p>
        <p>
          E-mail:{" "}
          <a href="mailto:chris@bionerg.com" className="text-blue-600 hover:underline">
            chris@bionerg.com
          </a>
        </p>
      </section>
      <div className="pt-4 flex gap-4 flex-col">
        <p>The type of personal information we collect</p>
        <ul className="list-disc list-inside space-y-2">
          <li>We do not consider public wallet addresses to be personal information.</li>
          <li>
            We currently collect and process the following information: email addresses from voluntary sign ups for
            alerts or bug communications
          </li>
        </ul>
        <p>How we get the personal information and why we have it</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            Most of the personal information we process is provided to us directly by you for one of the following
            reasons: to fulfil voluntary requests for auction alerts or bug communications.
          </li>
          <li>We do not receive personal information indirectly.</li>
          <li>
            We use the information that you have given us in order to alert you to auctions if requested, or respond to
            your bug submission if requested.
          </li>
          <li>We may share this information with our programming partners to resolve bugs.</li>
        </ul>
        <p>
          Under the UK General Data Protection Regulation (UK GDPR), the lawful bases we rely on for processing this
          information are:
        </p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            Your consent. You are able to remove your consent at any time. You can do this by contacting
            chris@bionerg.com for removal from auction alerts or chris@bionerg.com for removal from further bug
            discussion
          </li>
        </ul>
        <p>How we store your personal information</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            Your email address, if voluntarily given, is kept in a gmail held account with 2FA. We keep emails for one
            year. We will then dispose your information by clearing those email accounts which are the sole record of
            your email address.
          </li>
        </ul>
        <p>Your data protection rights Under data protection law, you have rights including:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Your right of access - You have the right to ask us for copies of your personal information.</li>
          <li>
            Your right to rectification - You have the right to ask us to rectify personal information you think is
            inaccurate. You also have the right to ask us to complete information you think is incomplete.
          </li>
          <li>
            Your right to erasure - You have the right to ask us to erase your personal information in certain
            circumstances.
          </li>
          <li>
            Your right to restriction of processing - You have the right to ask us to restrict the processing of your
            personal information in certain circumstances.
          </li>
          <li>
            Your right to object to processing - You have the the right to object to the processing of your personal
            information in certain circumstances.
          </li>
          <li>
            Your right to data portability - You have the right to ask that we transfer the personal information you
            gave us to another organisation, or to you, in certain circumstances.
          </li>
        </ul>
        <p>
          You are not required to pay any charge for exercising your rights. If you make a request, we have one month to
          respond to you. Please contact us at chris@bionerg.com for auction alert request removal, or chris@bionerg.com
          for bug report communication removal if you wish to make a request.
        </p>
        <p>How to complain</p>
        <ul className="list-disc list-inside space-y-2">
          <li>
            If you have any concerns about our use of your personal information, you can make a complaint to us at
            chris@bionerg.com.
          </li>
          <li>You can also complain to the ICO if you are unhappy with how we have used your data.</li>
        </ul>
        <p>The ICO’s address:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Information Commissioner’s Office</li>
          <li>Wycliffe House</li>
          <li>Water Lane</li>
          <li>Wilmslow</li>
          <li>Cheshire</li>
          <li>SK9 5AF</li>
        </ul>
        <p>Helpline number: 0303 123 1113</p>
        <p>
          ICO website:{" "}
          <a href="https://www.ico.org.uk/" target="_blank" rel="noopener noreferrer">
            https://www.ico.org.uk/
          </a>
        </p>
      </div>
    </div>
  );
}
