import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Smartphone, ArrowLeft, CheckCircle2, AlertCircle, Clock,
    Search, Check, ShieldCheck, RefreshCw, Printer, ChevronRight,
    Wallet, ArrowRight, Zap, Info, X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { bbpsService } from '../../../services/apiService';
import { useWallet } from '../../../context/WalletContext';

// Operator brand styling
const OPERATOR_META = {
    BILAVAIRTEL001: {
        name: 'Airtel',
        tag: 'Airtel Prepaid',
        bg: 'from-red-500 to-rose-600',
        badgeBg: 'bg-red-50 text-red-700 border-red-200',
        logoText: 'airtel'
    },
    BILAVJIO000001: {
        name: 'Jio',
        tag: 'Reliance Jio 5G',
        bg: 'from-blue-600 to-indigo-700',
        badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
        logoText: 'Jio'
    },
    BILAVVI0000001: {
        name: 'Vi',
        tag: 'Vodafone Idea',
        bg: 'from-amber-500 to-red-600',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        logoText: 'Vi'
    },
    BILAVBSNL00001: {
        name: 'BSNL',
        tag: 'BSNL Prepaid',
        bg: 'from-emerald-600 to-teal-700',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        logoText: 'BSNL'
    },
    BILAVMTNL00001: {
        name: 'MTNL',
        tag: 'MTNL Prepaid',
        bg: 'from-sky-600 to-cyan-700',
        badgeBg: 'bg-sky-50 text-sky-700 border-sky-200',
        logoText: 'MTNL'
    }
};

const PLAN_CATEGORIES = ['All', 'Popular', 'Unlimited', 'Data', 'Talktime', 'Validity', 'Annual'];

const ALL_CIRCLES = [
    'All India',
    'Andhra Pradesh & Telangana',
    'Assam',
    'Bihar & Jharkhand',
    'Chennai',
    'Delhi NCR',
    'Gujarat',
    'Haryana',
    'Himachal Pradesh',
    'Jammu & Kashmir',
    'Karnataka',
    'Kerala',
    'Kolkata',
    'Madhya Pradesh & Chhattisgarh',
    'Maharashtra & Goa',
    'Mumbai',
    'North East',
    'Odisha',
    'Punjab',
    'Rajasthan',
    'Tamil Nadu',
    'UP East',
    'UP West & Uttarakhand',
    'West Bengal'
];

const LIVE_OPERATOR_PLANS = {
    BILAVJIO000001: [
        { planId: 'JIO_189', amount: 189, validity: '28 Days', data: '2.0 GB Total', calls: 'Unlimited Calls', sms: '300 SMS', categoryType: 'Popular', description: 'Value Pack: Unlimited Voice, 2GB total data, 300 SMS, JioCinema, JioTV complimentary.' },
        { planId: 'JIO_198', amount: 198, validity: '14 Days', data: '2.0 GB/Day', calls: 'Unlimited 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Short Validity: Unlimited Voice, 2GB/day + Unlimited True 5G data, 100 SMS/day for 14 days.' },
        { planId: 'JIO_249', amount: 249, validity: '28 Days', data: '1.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Unlimited Voice, 1GB/day high speed data, 100 SMS/day for 28 days.' },
        { planId: 'JIO_299', amount: 299, validity: '28 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Standard 28 Days Pack: Unlimited Voice, 1.5GB/day data, 100 SMS/day.' },
        { planId: 'JIO_349', amount: 349, validity: '28 Days', data: '2.0 GB/Day', calls: 'Unlimited True 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Hero Pack: Unlimited Voice, 2GB/day + Unlimited True 5G data, 100 SMS/day.' },
        { planId: 'JIO_399', amount: 399, validity: '28 Days', data: '2.5 GB/Day', calls: 'Unlimited True 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Heavy Data: Unlimited Voice, 2.5GB/day + Unlimited True 5G data, 100 SMS/day.' },
        { planId: 'JIO_449', amount: 449, validity: '28 Days', data: '3.0 GB/Day', calls: 'Unlimited True 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Max Daily Data: Unlimited Voice, 3GB/day + Unlimited True 5G data, 100 SMS/day.' },
        { planId: 'JIO_579', amount: 579, validity: '56 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '56 Days Pack: Unlimited Voice + 1.5GB/day + 100 SMS/day.' },
        { planId: 'JIO_629', amount: 629, validity: '56 Days', data: '2.0 GB/Day', calls: 'Unlimited True 5G', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '56 Days Hero: Unlimited Voice + 2GB/day + Unlimited True 5G data.' },
        { planId: 'JIO_799', amount: 799, validity: '84 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '84 Days Pack: Unlimited Voice + 1.5GB/day data + 100 SMS/day for 84 days.' },
        { planId: 'JIO_859', amount: 859, validity: '84 Days', data: '2.0 GB/Day', calls: 'Unlimited True 5G', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '84 Days Hero Pack: Unlimited Voice + 2GB/day + Unlimited True 5G data.' },
        { planId: 'JIO_899', amount: 899, validity: '90 Days', data: '2.0 GB/Day + 20GB', calls: 'Unlimited True 5G', sms: '100 SMS/Day', categoryType: 'Unlimited', description: 'Hero 90-Day Pack: Unlimited Voice, 2GB/day + 20GB extra data, Unlimited True 5G.' },
        { planId: 'JIO_1029', amount: 1029, validity: '84 Days', data: '2.0 GB/Day', calls: 'Unlimited True 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Prime Video Edition: 84 Days, 2GB/day + Unlimited 5G + Prime Video Mobile Edition.' },
        { planId: 'JIO_1899', amount: 1899, validity: '336 Days', data: '24 GB Total', calls: 'Unlimited Calls', sms: '3600 SMS', categoryType: 'Annual', description: 'Annual Value Pack: Unlimited Calls + 24GB total data + 3600 SMS for 336 Days.' },
        { planId: 'JIO_3599', amount: 3599, validity: '365 Days', data: '2.5 GB/Day', calls: 'Unlimited True 5G', sms: '100 SMS/Day', categoryType: 'Annual', description: '1-Year Full Pack: Unlimited Voice + 2.5GB/day + Unlimited True 5G data for 365 Days.' },
        { planId: 'JIO_19', amount: 19, validity: 'Active Plan', data: '1.0 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '1.0 GB high speed data booster valid till existing base plan validity.' },
        { planId: 'JIO_29', amount: 29, validity: 'Active Plan', data: '2.0 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '2.0 GB high speed data booster valid till existing base plan validity.' },
        { planId: 'JIO_69', amount: 69, validity: 'Active Plan', data: '6.0 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '6.0 GB high speed data booster valid till existing base plan validity.' }
    ],
    BILAVAIRTEL001: [
        { planId: 'AIRTEL_199', amount: 199, validity: '28 Days', data: '2.0 GB Total', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Value Pack: Unlimited Calls + 2GB data total + 100 SMS/day for 28 days.' },
        { planId: 'AIRTEL_299', amount: 299, validity: '28 Days', data: '1.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Unlimited Calls + 1GB/day data + 100 SMS/day for 28 days.' },
        { planId: 'AIRTEL_349', amount: 349, validity: '28 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Standard 28 Days Pack: Unlimited Calls + 1.5GB/day data + 100 SMS/day.' },
        { planId: 'AIRTEL_379', amount: 379, validity: '1 Month', data: '2.0 GB/Day', calls: 'Unlimited 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Calendar Month: Unlimited Calls + 2GB/day + Unlimited 5G data.' },
        { planId: 'AIRTEL_409', amount: 409, validity: '28 Days', data: '2.5 GB/Day', calls: 'Unlimited 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Hero Pack: Unlimited Calls + 2.5GB/day + Unlimited 5G + Wynk Music.' },
        { planId: 'AIRTEL_449', amount: 449, validity: '28 Days', data: '3.0 GB/Day', calls: 'Unlimited 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Hotstar Pack: 3GB/day + Unlimited 5G + Disney+ Hotstar 3 Months Mobile.' },
        { planId: 'AIRTEL_579', amount: 579, validity: '56 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '56 Days Pack: Unlimited Calls + 1.5GB/day + 100 SMS/day for 56 days.' },
        { planId: 'AIRTEL_649', amount: 649, validity: '56 Days', data: '2.0 GB/Day', calls: 'Unlimited 5G', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '56 Days 5G Pack: Unlimited Calls + 2GB/day + Unlimited 5G data.' },
        { planId: 'AIRTEL_859', amount: 859, validity: '84 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '84 Days Pack: Unlimited Calls + 1.5GB/day data + 100 SMS/day for 84 days.' },
        { planId: 'AIRTEL_979', amount: 979, validity: '84 Days', data: '2.0 GB/Day', calls: 'Unlimited 5G', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '84 Days Hero: Unlimited Calls + 2GB/day data + Unlimited 5G + RewardsMini.' },
        { planId: 'AIRTEL_1199', amount: 1199, validity: '84 Days', data: '2.5 GB/Day', calls: 'Unlimited 5G', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Amazon Prime Pack: 84 Days, 2.5GB/day + Unlimited 5G + Amazon Prime Membership.' },
        { planId: 'AIRTEL_1999', amount: 1999, validity: '365 Days', data: '24 GB Total', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Annual', description: 'Annual Value: Unlimited Calls + 24GB total data + 100 SMS/day for 365 Days.' },
        { planId: 'AIRTEL_3599', amount: 3599, validity: '365 Days', data: '2.0 GB/Day', calls: 'Unlimited 5G', sms: '100 SMS/Day', categoryType: 'Annual', description: '365 Days 1-Year Pack: Unlimited Calls + 2GB/day data + Unlimited 5G.' },
        { planId: 'AIRTEL_22', amount: 22, validity: '1 Day', data: '1.0 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '1 GB data booster pack valid for 1 day.' },
        { planId: 'AIRTEL_33', amount: 33, validity: '1 Day', data: '2.0 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '2 GB data booster pack valid for 1 day.' },
        { planId: 'AIRTEL_77', amount: 77, validity: 'Active Plan', data: '5.0 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '5 GB data booster valid till existing base plan validity.' }
    ],
    BILAVVI0000001: [
        { planId: 'VI_199', amount: 199, validity: '28 Days', data: '2.0 GB Total', calls: 'Unlimited Calls', sms: '300 SMS', categoryType: 'Popular', description: 'Value Pack: Unlimited Voice, 2GB total data, 300 SMS for 28 days.' },
        { planId: 'VI_299', amount: 299, validity: '28 Days', data: '1.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Unlimited Voice, 1GB/day data, 100 SMS/day for 28 days.' },
        { planId: 'VI_349', amount: 349, validity: '28 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Hero Unlimited: Binge All Night (12am-6am), Weekend Data Rollover, 1.5GB/day.' },
        { planId: 'VI_365', amount: 365, validity: '28 Days', data: '2.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Hero Unlimited: 2GB/day data, Binge All Night, Weekend Rollover.' },
        { planId: 'VI_409', amount: 409, validity: '28 Days', data: '2.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Hero Unlimited: 2.5GB/day data, Binge All Night, Weekend Rollover.' },
        { planId: 'VI_449', amount: 449, validity: '28 Days', data: '3.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Hero Unlimited: 3GB/day data, Binge All Night, Weekend Rollover.' },
        { planId: 'VI_579', amount: 579, validity: '56 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '56 Days Hero Pack: Unlimited Calls + 1.5GB/day + Binge All Night.' },
        { planId: 'VI_649', amount: 649, validity: '56 Days', data: '2.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '56 Days Hero Pack: Unlimited Calls + 2GB/day + Binge All Night.' },
        { planId: 'VI_859', amount: 859, validity: '84 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '84 Days Pack: Unlimited Calls + 1.5GB/day + Binge All Night.' },
        { planId: 'VI_979', amount: 979, validity: '84 Days', data: '2.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '84 Days Hero Pack: Unlimited Calls + 2GB/day + Binge All Night.' },
        { planId: 'VI_1999', amount: 1999, validity: '365 Days', data: '24 GB Total', calls: 'Unlimited Calls', sms: '3600 SMS', categoryType: 'Annual', description: 'Annual Value: Unlimited Calls + 24GB total data + 3600 SMS for 365 Days.' },
        { planId: 'VI_3499', amount: 3499, validity: '365 Days', data: '1.5 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Annual', description: '365 Days Hero Annual Pack: Unlimited Calls + 1.5GB/day data + Binge All Night.' },
        { planId: 'VI_23', amount: 23, validity: '1 Day', data: '1.2 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '1.2 GB data booster pack valid for 1 day.' },
        { planId: 'VI_39', amount: 39, validity: '3 Days', data: '3.0 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '3 GB data booster pack valid for 3 days.' },
        { planId: 'VI_75', amount: 75, validity: '7 Days', data: '6.0 GB', calls: 'NA', sms: 'NA', categoryType: 'Data', description: '6 GB data booster pack valid for 7 days.' }
    ],
    BILAVBSNL00001: [
        { planId: 'BSNL_107', amount: 107, validity: '35 Days', data: '3.0 GB Total', calls: '200 Mins Voice', sms: 'NA', categoryType: 'Popular', description: '35 Days validity extension pack with 200 mins voice + 3GB data total.' },
        { planId: 'BSNL_153', amount: 153, validity: '26 Days', data: '1.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Unlimited Calls, 1GB/day data, 100 SMS/day for 26 days.' },
        { planId: 'BSNL_197', amount: 197, validity: '70 Days', data: '2.0 GB/Day (18D)', calls: 'Unlimited (18D)', sms: '100 SMS/Day', categoryType: 'Popular', description: '70 Days SIM validity extension: Unlimited Voice + 2GB/day for first 18 days.' },
        { planId: 'BSNL_199', amount: 199, validity: '30 Days', data: '2.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Unlimited Voice, 2GB/day data, 100 SMS/day for 30 days.' },
        { planId: 'BSNL_249', amount: 249, validity: '45 Days', data: '2.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Popular', description: 'Unlimited Voice, 2GB/day data, 100 SMS/day for 45 days.' },
        { planId: 'BSNL_397', amount: 397, validity: '150 Days', data: '2.0 GB/Day (30D)', calls: 'Unlimited (30D)', sms: '100 SMS/Day', categoryType: 'Unlimited', description: '150 Days validity pack: Unlimited voice + 2GB/day for first 30 days.' },
        { planId: 'BSNL_599', amount: 599, validity: '84 Days', data: '3.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Unlimited', description: 'Unlimited Voice, 3GB/day data, 100 SMS/day for 84 days.' },
        { planId: 'BSNL_1999', amount: 1999, validity: '365 Days', data: '600 GB Total', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Annual', description: '365 Days Annual pack: Unlimited Calls, 600GB lump-sum data, 100 SMS/day.' },
        { planId: 'BSNL_2399', amount: 2399, validity: '395 Days', data: '2.0 GB/Day', calls: 'Unlimited Calls', sms: '100 SMS/Day', categoryType: 'Annual', description: '395 Days Annual pack: Unlimited Calls, 2GB/day data, 100 SMS/day.' }
    ]
};

const MobilePrepaidFlow = ({ onBack }) => {
    const { balance, refreshWallet } = useWallet();

    // Operators & Circles state
    const [operators, setOperators] = useState([]);
    const [selectedOperator, setSelectedOperator] = useState(null);
    const [selectedCircle, setSelectedCircle] = useState('Bihar & Jharkhand');
    const [mobileNumber, setMobileNumber] = useState('');

    // Plans state
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [selectedCategoryTab, setSelectedCategoryTab] = useState('All');
    const [planSearch, setPlanSearch] = useState('');
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [customAmount, setCustomAmount] = useState('');

    // Workflow state: 'FORM' | 'CONFIRM' | 'PROCESSING' | 'RESULT'
    const [flowStep, setFlowStep] = useState('FORM');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [txnOutcome, setTxnOutcome] = useState(null);
    const [formError, setFormError] = useState('');

    // Load operators on mount
    useEffect(() => {
        let mounted = true;
        bbpsService.getOperators()
            .then(res => {
                if (!mounted) return;
                const list = Array.isArray(res) ? res : (res?.data || []);
                setOperators(list);
                if (list.length > 0) {
                    setSelectedOperator(list[0]);
                }
            })
            .catch(err => {
                console.error('Failed to load operators from backend:', err);
            });
        return () => { mounted = false; };
    }, []);

    // Load plans whenever operator or circle changes
    useEffect(() => {
        if (!selectedOperator) return;
        setLoadingPlans(true);
        setSelectedPlan(null);
        setCustomAmount('');

        bbpsService.getPlans(selectedOperator.billerId, selectedCircle)
            .then(res => {
                const list = Array.isArray(res) ? res : (res?.data || []);
                if (list.length > 0 && !list.some(p => Number(p.amount) === 239)) {
                    setPlans(list);
                } else {
                    setPlans(LIVE_OPERATOR_PLANS[selectedOperator.billerId] || list);
                }
            })
            .catch(err => {
                console.warn('Failed to load plans:', err);
                setPlans(LIVE_OPERATOR_PLANS[selectedOperator.billerId] || []);
            })
            .finally(() => setLoadingPlans(false));
    }, [selectedOperator, selectedCircle]);

    // Active amount resolution
    const finalAmount = useMemo(() => {
        if (selectedPlan && selectedPlan.amount) {
            return Number(selectedPlan.amount);
        }
        if (customAmount && !isNaN(customAmount) && Number(customAmount) > 0) {
            return Number(customAmount);
        }
        return 0;
    }, [selectedPlan, customAmount]);

    // Numeric balance
    const numBalance = useMemo(() => {
        const raw = parseFloat(String(balance || '0').replace(/[^0-9.-]+/g, ''));
        return isNaN(raw) ? 0 : raw;
    }, [balance]);

    const hasSufficientBalance = numBalance >= finalAmount && finalAmount > 0;

    // Filtered plans
    const filteredPlans = useMemo(() => {
        return plans.filter(p => {
            const matchesCategory = selectedCategoryTab === 'All'
                || (p.categoryType && p.categoryType.toLowerCase().includes(selectedCategoryTab.toLowerCase()))
                || (p.categorySubType && p.categorySubType.toLowerCase().includes(selectedCategoryTab.toLowerCase()));

            const matchesSearch = !planSearch
                || (p.amount && String(p.amount).includes(planSearch))
                || (p.description && p.description.toLowerCase().includes(planSearch.toLowerCase()))
                || (p.validity && p.validity.toLowerCase().includes(planSearch.toLowerCase()));

            return matchesCategory && matchesSearch;
        });
    }, [plans, selectedCategoryTab, planSearch]);

    // Validation
    const validateForm = () => {
        setFormError('');
        if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber)) {
            setFormError('Please enter a valid 10-digit Indian mobile number (starts with 6, 7, 8, or 9)');
            return false;
        }
        if (!selectedOperator) {
            setFormError('Please select a mobile operator / biller');
            return false;
        }
        if (!selectedCircle) {
            setFormError('Please select a telecom circle');
            return false;
        }
        if (finalAmount <= 0) {
            setFormError('Please select a plan or enter a valid recharge amount');
            return false;
        }
        if (finalAmount > 50000) {
            setFormError('Recharge amount cannot exceed ₹50,000');
            return false;
        }
        if (!hasSufficientBalance) {
            setFormError(`Insufficient wallet balance. Required: ₹${finalAmount.toFixed(2)}, Available: ₹${numBalance.toFixed(2)}`);
            return false;
        }
        return true;
    };

    const handleProceedToConfirm = (e) => {
        e.preventDefault();
        if (validateForm()) {
            setFlowStep('CONFIRM');
        }
    };

    // Execute recharge
    const handleExecuteRecharge = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setFormError('');

        const payload = {
            mobileNumber,
            billerId: selectedOperator.billerId,
            circle: selectedCircle,
            planId: selectedPlan?.planId || 'CUSTOM',
            planDescription: selectedPlan?.description || `Top-up of ₹${finalAmount}`,
            amount: finalAmount,
            idempotencyKey: `BBPS-MP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        };

        try {
            const res = await bbpsService.recharge(payload);

            // Refresh wallet balance on backend
            refreshWallet && refreshWallet();
            try { window.dispatchEvent(new Event('walletUpdated')); } catch (e) {}

            setTxnOutcome(res);
            setFlowStep('RESULT');

            if (res.success || res.status === 'SUCCESS') {
                try {
                    confetti({
                        particleCount: 90,
                        spread: 70,
                        origin: { y: 0.6 }
                    });
                } catch (e) {}
            }
        } catch (err) {
            console.error('Recharge submission error:', err);
            const msg = err.message || 'Transaction failed. Please try again.';
            setFormError(msg);
            setTxnOutcome({
                success: false,
                status: 'FAILED',
                amount: finalAmount,
                mobileNumber,
                billerName: selectedOperator.operatorName,
                circle: selectedCircle,
                message: msg
            });
            setFlowStep('RESULT');
            refreshWallet && refreshWallet();
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetAll = () => {
        setMobileNumber('');
        setSelectedPlan(null);
        setCustomAmount('');
        setTxnOutcome(null);
        setFormError('');
        setFlowStep('FORM');
    };

    return (
        <div className="space-y-5 font-['Inter',sans-serif] max-w-full">
            {/* Top Navigation & Breadcrumb */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={onBack}
                    className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-black font-black text-xs hover:border-blue-600 hover:text-blue-700 hover:shadow-xs transition-all cursor-pointer"
                >
                    <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                    <span>Back to all BBPS categories</span>
                </button>

                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-600">Wallet Available:</span>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                        ₹{numBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            {/* Header Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 md:p-6 shadow-xs">
                <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 opacity-10 blur-2xl" />
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 md:h-14 md:w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md flex items-center justify-center shrink-0">
                            <Smartphone className="h-7 w-7" strokeWidth={2.3} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg md:text-2xl font-black text-black tracking-tight">
                                    Mobile Prepaid Recharge
                                </h1>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    Bharat Connect
                                </span>
                            </div>
                            <p className="text-xs md:text-sm font-bold text-slate-700 mt-0.5">
                                Official BBPS recharge for Jio, Airtel, Vi, BSNL with instant plans & status
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Notification Banner */}
            {formError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                        <span>{formError}</span>
                    </div>
                    <button type="button" onClick={() => setFormError('')} className="text-rose-500 hover:text-rose-700">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            {flowStep === 'FORM' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* LEFT: Customer & Operator Input (5 Cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <h2 className="text-sm font-black text-black">1. Select Operator</h2>
                                <span className="text-[10px] font-bold text-slate-500">Live BBPS Billers</span>
                            </div>

                            {/* Operator Pills Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2.5">
                                {operators.map(op => {
                                    const meta = OPERATOR_META[op.billerId] || { name: op.operatorName, bg: 'from-slate-600 to-slate-800' };
                                    const isSelected = selectedOperator?.billerId === op.billerId;
                                    return (
                                        <button
                                            key={op.billerId}
                                            type="button"
                                            onClick={() => setSelectedOperator(op)}
                                            className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                                                isSelected
                                                    ? 'border-blue-600 bg-blue-50/50 shadow-xs ring-1 ring-blue-600'
                                                    : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-slate-100/60'
                                            }`}
                                        >
                                            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${meta.bg} text-white flex items-center justify-center font-black text-xs shadow-xs shrink-0`}>
                                                {op.operatorName.substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-black text-black truncate">{op.operatorName}</div>
                                                <div className="text-[10px] font-bold text-slate-500 truncate">{op.category}</div>
                                            </div>
                                            {isSelected && <Check className="w-4 h-4 text-blue-600 shrink-0" />}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="pt-2 border-t border-slate-100 space-y-3.5">
                                <h2 className="text-sm font-black text-black">2. Mobile Number & Circle</h2>

                                {/* Mobile Number */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Mobile Number <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-600 font-black text-xs pointer-events-none">
                                            <span>+91</span>
                                            <span className="text-slate-300">|</span>
                                        </div>
                                        <input
                                            type="tel"
                                            maxLength={10}
                                            value={mobileNumber}
                                            onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                                            placeholder="Enter 10-digit mobile number"
                                            className="w-full pl-14 pr-4 py-2.5 text-sm font-black rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-black tracking-wide placeholder-slate-400"
                                        />
                                    </div>
                                    {mobileNumber && mobileNumber.length !== 10 && (
                                        <p className="text-[11px] text-amber-600 font-bold mt-1">
                                            Enter remaining {10 - mobileNumber.length} digits
                                        </p>
                                    )}
                                </div>

                                {/* Circle Selection */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Telecom Circle <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={selectedCircle}
                                        onChange={(e) => setSelectedCircle(e.target.value)}
                                        className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-black cursor-pointer"
                                    >
                                        {(selectedOperator?.supportedCircles || ALL_CIRCLES).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Custom Amount */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Recharge Amount (₹) <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 font-black text-sm">₹</span>
                                        <input
                                            type="text"
                                            value={selectedPlan ? selectedPlan.amount : customAmount}
                                            onChange={(e) => {
                                                setSelectedPlan(null);
                                                setCustomAmount(e.target.value.replace(/\D/g, ''));
                                            }}
                                            placeholder="Select a plan below or type amount"
                                            className="w-full pl-8 pr-20 py-2.5 text-sm font-black rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 text-black placeholder-slate-400"
                                        />
                                        {selectedPlan && (
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPlan(null)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-blue-700 bg-blue-100 hover:bg-blue-200 px-2 py-0.5 rounded-md"
                                            >
                                                Custom
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Selected Plan Snapshot Pill */}
                                {selectedPlan && (
                                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs space-y-1">
                                        <div className="flex items-center justify-between font-black text-blue-900">
                                            <span>Selected Plan: ₹{selectedPlan.amount}</span>
                                            <span>{selectedPlan.validity}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-700 font-bold line-clamp-2">
                                            {selectedPlan.description}
                                        </p>
                                    </div>
                                )}

                                {/* Proceed Button */}
                                <button
                                    type="button"
                                    onClick={handleProceedToConfirm}
                                    disabled={!mobileNumber || mobileNumber.length !== 10 || finalAmount <= 0 || !hasSufficientBalance}
                                    className={`w-full py-3 rounded-xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm ${
                                        !mobileNumber || mobileNumber.length !== 10 || finalAmount <= 0 || !hasSufficientBalance
                                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                            : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md active:scale-[0.99]'
                                    }`}
                                >
                                    <span>Proceed to Recharge (₹{finalAmount})</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Plan Browser & Category Tabs (7 Cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs space-y-3.5">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-sm font-black text-black">
                                        Recharge Plans for {selectedOperator?.operatorName}
                                    </h3>
                                    <p className="text-[11px] font-bold text-slate-500">
                                        {selectedCircle} Circle
                                    </p>
                                </div>

                                {/* Search in plans */}
                                <div className="relative w-full sm:w-56">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                                    <input
                                        type="text"
                                        value={planSearch}
                                        onChange={(e) => setPlanSearch(e.target.value)}
                                        placeholder="Search by ₹ or data..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 text-black placeholder-slate-400"
                                    />
                                </div>
                            </div>

                            {/* Plan Category Filter Tabs */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                {PLAN_CATEGORIES.map(tab => (
                                    <button
                                        key={tab}
                                        type="button"
                                        onClick={() => setSelectedCategoryTab(tab)}
                                        className={`px-3 py-1 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                                            selectedCategoryTab === tab
                                                ? 'bg-blue-600 text-white shadow-2xs'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-black'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            {/* Plan List Grid */}
                            {loadingPlans ? (
                                <div className="py-14 text-center space-y-2">
                                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                                    <p className="text-xs font-bold text-slate-600">Retrieving official operator plans...</p>
                                </div>
                            ) : filteredPlans.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                                    {filteredPlans.map(plan => {
                                        const isChosen = selectedPlan?.planId === plan.planId;
                                        return (
                                            <div
                                                key={plan.planId}
                                                onClick={() => {
                                                    setSelectedPlan(plan);
                                                    setCustomAmount('');
                                                }}
                                                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                                    isChosen
                                                        ? 'border-blue-600 bg-blue-50/40 shadow-xs ring-2 ring-blue-600/30'
                                                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/70'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-baseline justify-between mb-1.5">
                                                        <span className="text-lg font-black text-black">
                                                            ₹{plan.amount}
                                                        </span>
                                                        <span className="text-[11px] font-black text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                            {plan.validity}
                                                        </span>
                                                    </div>

                                                    {plan.data && (
                                                        <div className="text-[11px] font-black text-blue-700 mb-1">
                                                            Data: {plan.data}
                                                        </div>
                                                    )}

                                                    <p className="text-[11px] font-bold text-slate-700 leading-snug line-clamp-3">
                                                        {plan.description}
                                                    </p>
                                                </div>

                                                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                        {plan.categoryType}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        className={`text-[11px] font-black px-2.5 py-1 rounded-lg transition-colors ${
                                                            isChosen
                                                                ? 'bg-blue-600 text-white'
                                                                : 'bg-slate-100 text-slate-800 hover:bg-blue-600 hover:text-white'
                                                        }`}
                                                    >
                                                        {isChosen ? 'Selected' : 'Select'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-12 text-center text-slate-500 space-y-1">
                                    <p className="text-xs font-bold">No plans found matching your criteria</p>
                                    <p className="text-[11px]">You can still enter a custom recharge amount on the left form</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION SCREEN */}
            {flowStep === 'CONFIRM' && (
                <div className="max-w-xl mx-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-600" />
                            <h2 className="text-base font-black text-black">Confirm Mobile Recharge</h2>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFlowStep('FORM')}
                            className="text-xs font-bold text-slate-600 hover:text-black"
                        >
                            Edit
                        </button>
                    </div>

                    <div className="space-y-3 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/90 text-xs font-bold">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-600">Mobile Number</span>
                            <span className="font-black text-black text-sm">+91 {mobileNumber}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-600">Operator</span>
                            <span className="font-black text-black">{selectedOperator?.operatorName}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-600">Circle</span>
                            <span className="font-black text-black">{selectedCircle}</span>
                        </div>
                        {selectedPlan && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-600">Plan Validity</span>
                                <span className="font-black text-black">{selectedPlan.validity}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-600">Payment Source</span>
                            <span className="font-black text-black flex items-center gap-1">
                                <Wallet className="w-3.5 h-3.5 text-blue-600" />
                                Rupiksha Wallet
                            </span>
                        </div>
                        <div className="flex justify-between py-2 items-baseline text-sm">
                            <span className="font-black text-black">Recharge Amount</span>
                            <span className="font-black text-blue-600 text-lg">₹{finalAmount.toFixed(2)}</span>
                        </div>
                    </div>

                    {selectedPlan?.description && (
                        <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 text-[11px] text-slate-700 font-bold">
                            <span className="font-black text-blue-900 block mb-0.5">Plan Benefits:</span>
                            {selectedPlan.description}
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setFlowStep('FORM')}
                            disabled={isSubmitting}
                            className="flex-1 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs transition-colors cursor-pointer"
                        >
                            Back & Edit
                        </button>
                        <button
                            type="button"
                            onClick={handleExecuteRecharge}
                            disabled={isSubmitting}
                            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.99] disabled:opacity-60"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Processing Recharge...</span>
                                </>
                            ) : (
                                <>
                                    <span>Confirm & Pay ₹{finalAmount}</span>
                                    <Check className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* TRANSACTION RESULT SCREEN */}
            {flowStep === 'RESULT' && txnOutcome && (
                <div className="max-w-xl mx-auto rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-lg text-center space-y-5">
                    {txnOutcome.status === 'SUCCESS' ? (
                        <>
                            <div className="w-16 h-16 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mx-auto text-emerald-600 shadow-xs">
                                <CheckCircle2 className="w-9 h-9" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-black">Recharge Successful!</h2>
                                <p className="text-xs font-bold text-slate-600">
                                    Your prepaid mobile has been recharged instantly via BBPS
                                </p>
                            </div>
                        </>
                    ) : txnOutcome.status === 'PENDING' ? (
                        <>
                            <div className="w-16 h-16 rounded-full bg-amber-50 border-4 border-amber-100 flex items-center justify-center mx-auto text-amber-600 shadow-xs">
                                <Clock className="w-9 h-9" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-black">Recharge In Progress</h2>
                                <p className="text-xs font-bold text-slate-600">
                                    The provider network is confirming the transaction. Status will update in BBPS History.
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-full bg-rose-50 border-4 border-rose-100 flex items-center justify-center mx-auto text-rose-600 shadow-xs">
                                <AlertCircle className="w-9 h-9" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-black">Recharge Failed</h2>
                                <p className="text-xs font-bold text-slate-600">
                                    {txnOutcome.message || 'The recharge could not be completed.'}
                                </p>
                            </div>
                        </>
                    )}

                    {/* Receipt Details Box */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs font-bold space-y-2">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Transaction Ref</span>
                            <span className="font-mono font-black text-black">{txnOutcome.merchantRefNo || txnOutcome.transactionId || 'N/A'}</span>
                        </div>
                        {txnOutcome.providerTxnId && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">BBPS Provider Ref</span>
                                <span className="font-mono font-black text-black">{txnOutcome.providerTxnId}</span>
                            </div>
                        )}
                        {txnOutcome.approvalRefNo && (
                            <div className="flex justify-between py-1 border-b border-slate-200/60">
                                <span className="text-slate-500">Approval Number</span>
                                <span className="font-mono font-black text-black">{txnOutcome.approvalRefNo}</span>
                            </div>
                        )}
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Mobile Number</span>
                            <span className="font-black text-black">+91 {txnOutcome.mobileNumber}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                            <span className="text-slate-500">Operator</span>
                            <span className="font-black text-black">{txnOutcome.billerName}</span>
                        </div>
                        <div className="flex justify-between py-1 items-baseline">
                            <span className="text-slate-500">Amount Paid</span>
                            <span className="font-black text-blue-600 text-base">₹{txnOutcome.amount}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex-1 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-black text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print Receipt</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleResetAll}
                            className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition-all cursor-pointer shadow-sm"
                        >
                            + New Recharge
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MobilePrepaidFlow;
