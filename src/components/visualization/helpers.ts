export const reverseComplement = (sequence: string): string => {
    return sequence.split('').reverse().map(base => {
        switch (base) {
            case 'A': return 'T';
            case 'T': return 'A';
            case 'C': return 'G';
            case 'G': return 'C';
            default: return base;
        }
    }).join('');
}
