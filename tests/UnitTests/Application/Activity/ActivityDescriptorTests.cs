using MathilensERP.Application.Activity;
using MathilensERP.Application.Customers.Commands.Create;
using MathilensERP.Application.Orders.Commands.TransitionStatus;
using MathilensERP.Application.Orders.Queries.Search;

namespace MathilensERP.UnitTests.Application.Activity;

public class ActivityDescriptorTests
{
    [Fact]
    public void ScreenFor_TakesTheModuleSegmentOfTheNamespace()
    {
        Assert.Equal("Customers", ActivityDescriptor.ScreenFor(typeof(CreateCustomerCommand)));
        Assert.Equal("Orders", ActivityDescriptor.ScreenFor(typeof(TransitionOrderStatusCommand)));
        Assert.Equal("Orders", ActivityDescriptor.ScreenFor(typeof(SearchOrdersQuery)));
    }

    [Fact]
    public void ScreenFor_WithATypeOutsideTheApplicationAssembly_FallsBackRatherThanThrowing()
    {
        Assert.Equal("General", ActivityDescriptor.ScreenFor(typeof(string)));
    }

    [Fact]
    public void ActionFor_ReadsAsWords()
    {
        Assert.Equal("Create Customer", ActivityDescriptor.ActionFor(typeof(CreateCustomerCommand)));
        Assert.Equal("Transition Order Status", ActivityDescriptor.ActionFor(typeof(TransitionOrderStatusCommand)));
    }
}
