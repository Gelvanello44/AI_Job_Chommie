import React, { useState } from 'react'
import { BUSINESS_BANK, BUSINESS_INFO } from '@/lib/config'
import { Copy } from 'lucide-react'

export default function BankTransferDetails({ amountZar, plan }) {
  const [copied, setCopied] = useState('')
  const copy = async (text, tag) => {
    try { await navigator.clipboard.writeText(text); setCopied(tag); setTimeout(()=>setCopied(''), 1500) } catch {}
  }
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6 text-gray-300">
      <div className="text-white font-semibold mb-2">Pay via Bank Transfer (EFT)</div>
      <p className="text-sm mb-4">Use your full name or email as payment reference. Send proof of payment to admin@aijobchommie.co.za for faster activation.</p>
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-400">Account holder</div>
          <div className="flex items-center gap-2">
            <span className="text-white">{BUSINESS_BANK.accountHolder}</span>
          </div>
        </div>
        <div>
          <div className="text-gray-400">Bank</div>
          <div className="text-white">{BUSINESS_BANK.bankName}</div>
        </div>
        <div>
          <div className="text-gray-400">Account type</div>
          <div className="text-white">{BUSINESS_BANK.accountType}</div>
        </div>
        <div>
          <div className="text-gray-400">Branch code</div>
          <div className="flex items-center gap-2">
            <span className="text-white">{BUSINESS_BANK.branchCode}</span>
            <button onClick={()=>copy(BUSINESS_BANK.branchCode,'branch')} className="p-1 rounded hover:bg-white/10" title="Copy">
              <Copy className="h-4 w-4 text-gray-400" />
            </button>
            {copied==='branch' && <span className="text-xs text-cyan-400">Copied</span>}
          </div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-gray-400">Account number</div>
          <div className="flex items-center gap-2">
            <span className="text-white tracking-wider">{BUSINESS_BANK.accountNumber}</span>
            <button onClick={()=>copy(BUSINESS_BANK.accountNumber,'acct')} className="p-1 rounded hover:bg-white/10" title="Copy">
              <Copy className="h-4 w-4 text-gray-400" />
            </button>
            {copied==='acct' && <span className="text-xs text-cyan-400">Copied</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 text-sm">
        <div className="text-gray-400">Amount</div>
        <div className="text-white text-lg font-semibold">R{amountZar} {plan ? `• ${plan}` : ''}</div>
      </div>
      <div className="mt-6 text-xs text-gray-400">
        <div>Registered name: {BUSINESS_INFO.registeredName}</div>
        <div>Taxpayer registration number: {BUSINESS_INFO.taxpayerRegistrationNumber}</div>
        <div>Taxpayer reference number: {BUSINESS_INFO.taxpayerReferenceNumber}</div>
      </div>
    </div>
  )
}
