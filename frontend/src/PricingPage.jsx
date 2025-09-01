import React from 'react'
import { DollarSign, Check } from 'lucide-react'
import { Link } from 'react-router-dom'

const Section = ({ title, children }) => (
  <section className="bg-white/5 backdrop-blur-sm rounded-xl p-8 border border-white/10">
    <h2 className="text-3xl font-bold text-cyan-400 mb-6">{title}</h2>
    <div className="text-gray-300 leading-relaxed text-lg">
      {children}
    </div>
  </section>
)

const PlanCard = ({ badge, title, price, subtitle, sections }) => (
  <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden flex flex-col">
    <div className="px-8 pt-8">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-gray-300 bg-white/10 rounded-full px-3 py-1">{badge}</span>
      </div>
      <h3 className="text-2xl font-semibold text-white">{title}</h3>
      {price && (
        <div className="mt-2 text-cyan-400 font-bold">{price}</div>
      )}
      {subtitle && (
        <p className="mt-3 text-gray-300">{subtitle}</p>
      )}
    </div>
    <div className="p-8 space-y-6">
      {sections}
    </div>
    <div className="px-8 pb-8 mt-auto">
      <Link to="/payment" className="block w-full bg-cyan-500 hover:bg-cyan-600 text-white text-center px-8 py-3 rounded-lg font-semibold transition-all duration-200">
        Select
      </Link>
    </div>
  </div>
)

export default function PricingPage() {
  return (
    <div className="min-h-screen pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-14">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">INDIVIDUAL PACKAGES</h1>
          <p className="text-xl text-gray-300">For Job Seekers Ready to Accelerate Their Careers</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* FREE PLAN */}
          <PlanCard
            badge="FREE PLAN"
            title="Career Starter"
            price=""
            subtitle="Perfect for: Students, career changers, and first-time job seekers"
            sections={(
              <>
                <div>
                  <h4 className="text-white font-semibold mb-3">AUTO JOB APPLICATIONS:</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> 2 monthly auto job applications with basic AI matching</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Job preferences setup (roles, provinces, remote options)</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> "Auto apply" settings with confirmation modals</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Monthly quota meter and usage tracking</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> "Upcoming applications" widget display</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> "Usage this month" dashboard widget</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">CV BUILDER & TEMPLATES:</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Standard CV template with ATS optimization</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> CV builder/editor with template selection</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Export/download as PDF functionality</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> ATS guidance hints and scoring</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">SKILLS ASSESSMENT & QUIZ:</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Skills assessment quiz (identifies top 3 strengths)</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Quiz results dashboard with detailed insights</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Shareable skill badges for LinkedIn/profile</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Retake quiz with recommended cadence</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">APPLICATION TRACKING:</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Applications tracker (list and kanban views)</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Status change UX (applied, interview, offer, etc.)</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Application timeline and progress tracking</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Notes system for each application</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Next-action prompts and follow-up reminders</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">JOB MARKET INSIGHTS:</h4>
                  <ul className="space-y-2 text-gray-300">
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Monthly job market newsletter</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Email opt-in management and preferences</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> Newsletter archive with past insights</li>
                    <li className="flex items-start gap-2"><Check className="h-5 w-5 text-cyan-400 mt-1" /> South Africa-focused market insights card</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">VALUE PROPOSITION:</h4>
                  <p className="italic text-gray-200">"Start your career journey with professional tools and intelligent automation - upgrade when you\\'re ready to accelerate results"</p>
                </div>
              </>
            )}
          />

          {/* PROFESSIONAL PLAN */}
          <PlanCard
            badge="PROFESSIONAL PLAN"
            title="The Career Accelerator"
            price="R8/month"
            subtitle="Perfect for: Active job seekers wanting consistent opportunities"
            sections={(
              <>
                <div>
                  <h4 className="text-white font-semibold mb-3">EVERYTHING IN FREE PLAN PLUS:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> 5 monthly auto job applications with advanced AI matching</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Enhanced preferences with job match explanations</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Adjustable application frequency and quota meter</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">PROFESSIONAL CV & COVER LETTERS:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Professional CV optimization with industry-specific keywords</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> CV keyword recommendations with diff view</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Accept/reject keyword suggestions interface</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Custom cover letter generation per application</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Cover letter editor with tone controls and variants</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Attach-to-application workflow</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">WEEKLY JOB ALERTS & RESEARCH:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Weekly job alerts for SA opportunities</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Alerts setup (roles, provinces, salary ranges)</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Digest preview and delivery channel preferences</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Company research briefings with insights</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Research drawer/panel on job details</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Company pages with "save brief" feature</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">ANALYTICS & BENCHMARKING:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Application performance analytics dashboard</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Applications vs interviews conversion tracking</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Response rates and time-to-interview metrics</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Salary benchmarking for your role/experience</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Benchmark widget on job details</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Filters by province and experience level</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">PROFESSIONAL TOOLS:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Interview scheduling with calendar sync</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Availability picker (Outlook/Google Calendar)</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Timezone handling for remote interviews</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Follow-up template library with 1-click copy</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Contextual suggestions by application status</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> LinkedIn profile optimization guide</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Optimization checklist with profile parser</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Progress tracker for profile completeness</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Reference management system</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> References list with request workflows</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Visibility controls for references</li>
                  </ul>
                </div>
              </>
            )}
          />

          {/* EXECUTIVE PLAN */}
          <PlanCard
            badge="EXECUTIVE PLAN"
            title="The Leadership Advantage"
            price="R17/month"
            subtitle="Perfect for: Senior professionals and executives"
            sections={(
              <>
                <div>
                  <h4 className="text-white font-semibold mb-3">EVERYTHING IN PROFESSIONAL PLAN PLUS:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> 8 monthly auto job applications (executive-level)</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Increased quota with executive role filters</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Headhunter visibility settings</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">EXECUTIVE CV CRAFTING:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Executive CV template with leadership positioning</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Leadership achievements highlights section</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Executive review flow for CV optimization</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Advanced cover letters with executive communication style</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">PERSONAL BRAND STRATEGY:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Personal brand audit and assessment</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Brand scorecard with metrics tracking</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Strategic action plan for brand development</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Content calendar suggestions for thought leadership</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">EXECUTIVE NETWORKING:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Executive networking event notifications</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Curated events list with industry focus</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> RSVP system with calendar integration</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Event reminder and follow-up workflows</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">CAREER TRAJECTORY PLANNING:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Career roadmap with milestone planning</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> OKR (Objectives & Key Results) framework</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Milestone tracking with progress indicators</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Automated milestone reminders and check-ins</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">HEADHUNTER POSITIONING:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Visibility toggles for recruiter searches</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Preference controls for headhunter matching</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Recruiter view preview of your profile</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Executive search optimization</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">LEADERSHIP ASSESSMENT:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Comprehensive leadership assessment flow</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Results dashboard with insights</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Development recommendations</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Actions feed for continuous improvement</li>
                  </ul>
                </div>

                <div>
                  <h4 className="text-white font-semibold mb-3">PREMIUM SUPPORT & EXTRAS:</h4>
                  <ul className="space-y-2 text-gray-300 text-sm">
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Priority support (24-hour response time)</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Industry intelligence reports with market trends</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Mock interview sessions for senior-level scenarios</li>
                    <li className="flex items-start gap-2"><Check className="h-4 w-4 text-cyan-400 mt-0.5" /> Access to hidden job market opportunities</li>
                  </ul>
                </div>
              </>
            )}
          />
        </div>

        <div className="text-center mt-12">
          <p className="text-sm text-gray-400">** Weekly alerts currently focused on South Africa. More localized options planned.</p>
        </div>
      </div>
    </div>
  )
}


