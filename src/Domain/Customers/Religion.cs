namespace MathilensERP.Domain.Customers;

/// <summary>
/// A customer's religion, optional on <see cref="Customer"/>. A fixed set rather than free text
/// because it is filtered on — free text spells the same religion five ways and makes the filter
/// unreliable. <see cref="Other"/> exists so no customer has to be recorded inaccurately.
/// </summary>
public enum Religion
{
    Hindu,
    Muslim,
    Christian,
    Sikh,
    Jain,
    Buddhist,
    Other
}
